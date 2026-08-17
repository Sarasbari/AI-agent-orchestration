const express = require('express');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const runModel = require('../models/runModel');
const workflowModel = require('../models/workflowModel');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);

// Middleware to verify user owns the run
const verifyRunOwnership = async (req, res, next) => {
  const runId = req.params.id;
  const run = await runModel.getRunById(runId);
  if (!run) {
    return next(new AppError('Run not found', 404));
  }
  
  const workflow = await workflowModel.findById(run.workflow_id);
  if (!workflow || workflow.user_id !== req.user.id) {
    return next(new AppError('Access denied', 403));
  }
  
  req.run = run;
  next();
};

/**
 * GET /api/runs/:id
 * Get details of a specific run and its node executions
 */
router.get('/:id', verifyRunOwnership, asyncHandler(async (req, res) => {
  const nodes = await runModel.getNodeExecutionsByRunId(req.params.id);
  res.json({
    run: req.run,
    nodes
  });
}));

/**
 * GET /api/runs/:id/stream
 * SSE endpoint for live run status
 */
router.get('/:id/stream', verifyRunOwnership, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  const runId = req.params.id;
  
  // Initial state
  let lastStatus = '';
  
  const sendUpdates = async () => {
    try {
      const run = await runModel.getRunById(runId);
      const nodes = await runModel.getNodeExecutionsByRunId(runId);
      
      const payload = JSON.stringify({ run, nodes });
      if (payload !== lastStatus) {
        res.write(`data: ${payload}\n\n`);
        lastStatus = payload;
      }
      
      if (run.status !== 'running') {
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      console.error('SSE Error:', err);
      clearInterval(interval);
      res.end();
    }
  };
  
  sendUpdates();
  const interval = setInterval(sendUpdates, 1000);
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

/**
 * POST /api/runs/:id/nodes/:nodeId/retry
 * Retry a failed node execution
 */
router.post('/:id/nodes/:nodeId/retry', verifyRunOwnership, asyncHandler(async (req, res) => {
  const { id: runId } = req.params;
  const { nodeId } = req.params;
  
  // 1. Verify node execution exists and is failed
  const nodeExec = await runModel.getNodeExecution(runId, nodeId);
  if (!nodeExec) {
    throw new AppError('Node execution not found', 404);
  }
  if (nodeExec.status !== 'failed') {
    throw new AppError(`Cannot retry node with status "${nodeExec.status}". Only failed nodes can be retried.`, 400);
  }

  // 2. Get the workflow DAG to find the node config
  const workflow = await workflowModel.findById(req.run.workflow_id);
  const dag = workflow.dag_definition;
  const dagNode = dag.nodes.find(n => n.id === nodeId);
  if (!dagNode) {
    throw new AppError('Node not found in workflow DAG definition', 404);
  }

  // 3. Reset node execution status to pending
  await runModel.resetNodeExecution(runId, nodeId);

  // 4. If the run itself was failed, re-open it
  const { query } = require('../db/pool');
  if (req.run.status === 'failed') {
    await query(
      `UPDATE workflow_runs SET status = 'running', completed_at = NULL, error = NULL WHERE id = $1`,
      [runId]
    );
  }

  // 5. Re-enqueue to BullMQ
  const { executeNodeQueue } = require('../services/queueService');
  await executeNodeQueue.add('execute', {
    runId,
    nodeId: dagNode.id,
    nodeType: dagNode.type,
    nodeConfig: dagNode.config,
    userId: req.user.id
  }, {
    jobId: `${runId}-${dagNode.id}-retry-${Date.now()}`,
    attempts: 4,
    backoff: { type: 'exponential', delay: 2000 }
  });

  res.json({ message: 'Node retry enqueued', nodeId });
}));

module.exports = router;

