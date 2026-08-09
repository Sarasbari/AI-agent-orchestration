const runModel = require('../models/runModel');
const workflowModel = require('../models/workflowModel');
const { executeNodeQueue } = require('./queueService');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../logger');

const runService = {
  /**
   * Triggers a new execution run for a workflow.
   * Finds entry nodes (no incoming edges) and enqueues them.
   */
  async triggerRun(workflowId, userId) {
    // 1. Verify workflow belongs to user
    const workflow = await workflowModel.findById(workflowId);
    if (!workflow) {
      throw new AppError('Workflow not found', 404, 'NOT_FOUND');
    }
    if (workflow.user_id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const { nodes, edges } = workflow.dag_definition;
    if (!nodes || nodes.length === 0) {
      throw new AppError('Workflow has no nodes to execute', 400, 'EMPTY_DAG');
    }

    // 2. Find start nodes (in-degree = 0)
    const hasIncoming = new Set();
    edges.forEach((edge) => hasIncoming.add(edge.target));
    
    const startNodes = nodes.filter((n) => !hasIncoming.has(n.id));
    if (startNodes.length === 0) {
      throw new AppError('Workflow has no clear start nodes (is it cyclic?)', 400, 'NO_START_NODES');
    }

    // 3. Create run & node executions in DB
    const run = await runModel.createRun(workflowId);
    const startNodeIds = startNodes.map(n => n.id);
    const nodeExecutions = await runModel.createNodeExecutions(run.id, startNodeIds);

    // 4. Enqueue to BullMQ
    for (const node of startNodes) {
      await executeNodeQueue.add('execute', {
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        nodeConfig: node.config // the configuration for the node
      }, {
        jobId: `${run.id}-${node.id}`, // Prevent duplicate enqueues
        attempts: 4, // 1 initial + 3 retries
        backoff: {
          type: 'exponential',
          delay: 2000 // 2s, 4s, 8s
        }
      });
    }

    logger.info({ runId: run.id, startNodes: startNodeIds }, 'Workflow run triggered');
    return run;
  }
};

module.exports = runService;
