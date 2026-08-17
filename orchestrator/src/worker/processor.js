const { query } = require('../db/pool');
const { executeNodeQueue } = require('../services/queueService');
const nodeDispatcher = require('./nodeDispatcher');
const logger = require('../logger');

/**
 * Processor for the execute-node job
 */
const processNodeExecution = async (job) => {
  const { runId, nodeId, nodeType, nodeConfig, userId } = job.data;
  
  logger.info({ runId, nodeId, nodeType, attempt: job.attemptsMade }, 'Processing node execution');
  
  try {
    // 1. Mark node as RUNNING
    await query(
      `UPDATE node_executions 
       SET status = 'running', started_at = NOW(), retry_count = $3 
       WHERE run_id = $1 AND node_id = $2`,
      [runId, nodeId, job.attemptsMade]
    );

    // 1b. Fetch workflow dag to know inputs (from previous nodes) and edges (for next nodes)
    const runResult = await query(
      `SELECT w.dag_definition FROM workflow_runs r 
       JOIN workflows w ON r.workflow_id = w.id 
       WHERE r.id = $1`,
      [runId]
    );
    const dag = runResult.rows[0].dag_definition;

    // 1c. Get upstream node outputs if any
    const incomingEdges = dag.edges.filter(e => e.target === nodeId);
    let inputs = {};
    if (incomingEdges.length > 0) {
      const sourceIds = incomingEdges.map(e => e.source);
      const prevNodes = await query(
        `SELECT node_id, output FROM node_executions 
         WHERE run_id = $1 AND node_id = ANY($2) AND status = 'completed'`,
        [runId, sourceIds]
      );
      
      // Check if all upstream nodes completed
      if (prevNodes.rows.length < sourceIds.length) {
         logger.warn('Upstream nodes not fully completed yet. This node might have been enqueued prematurely, or upstream failed.');
      }
      
      prevNodes.rows.forEach(row => {
        inputs[row.node_id] = row.output;
      });
    }

    // 2. Dispatch based on nodeType
    const output = await nodeDispatcher.execute(nodeType, nodeConfig, inputs, userId);

    // 3. Mark node as COMPLETED with output
    await query(
      `UPDATE node_executions 
       SET status = 'completed', completed_at = NOW(), output = $3 
       WHERE run_id = $1 AND node_id = $2`,
      [runId, nodeId, JSON.stringify(output)]
    );

    // 4. Enqueue next node(s)
    const outgoingEdges = dag.edges.filter(e => e.source === nodeId);
    for (const edge of outgoingEdges) {
      // For condition nodes, we might need to follow only specific edges based on output
      if (nodeType === 'condition') {
        const branchConditionMatch = (output.result === true && edge.label === 'true') || 
                                     (output.result === false && edge.label === 'false');
        if (!branchConditionMatch) {
           continue; // skip this edge
        }
      }

      const nextNode = dag.nodes.find(n => n.id === edge.target);
      if (nextNode) {
        // Create pending node execution
        await query(
          `INSERT INTO node_executions (run_id, node_id, status) 
           VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`,
          [runId, nextNode.id]
        );

        await executeNodeQueue.add('execute', {
          runId,
          nodeId: nextNode.id,
          nodeType: nextNode.type,
          nodeConfig: nextNode.config,
          userId
        }, {
          jobId: `${runId}-${nextNode.id}`,
          attempts: 4,
          backoff: { type: 'exponential', delay: 2000 }
        });
      }
    }

    return { success: true, output };
  } catch (err) {
    logger.error({ runId, nodeId, err: err.message }, 'Node execution failed');
    
    // Mark as failed if it's the last attempt, otherwise leave it running/pending for BullMQ to retry
    if (job.attemptsMade >= job.opts.attempts - 1) {
      await query(
        `UPDATE node_executions 
         SET status = 'failed', completed_at = NOW(), error = $3 
         WHERE run_id = $1 AND node_id = $2`,
        [runId, nodeId, err.message]
      );
      
      // Also mark run as failed
      await query(
        `UPDATE workflow_runs SET status = 'failed', completed_at = NOW(), error = $2 WHERE id = $1`,
        [runId, `Node ${nodeId} failed: ${err.message}`]
      );
    }
    
    throw err; // Let BullMQ handle retries
  }
};

module.exports = {
  processNodeExecution
};
