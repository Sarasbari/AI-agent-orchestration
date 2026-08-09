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

module.exports = router;
