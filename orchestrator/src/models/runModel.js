const { query } = require('../db/pool');

const runModel = {
  async createRun(workflowId) {
    const result = await query(
      `INSERT INTO workflow_runs (workflow_id, status, started_at) 
       VALUES ($1, 'running', NOW()) RETURNING *`,
      [workflowId]
    );
    return result.rows[0];
  },

  async createNodeExecutions(runId, nodeIds) {
    if (!nodeIds || nodeIds.length === 0) return [];
    
    // Create placeholders like '($1, $2), ($1, $3)'
    const values = [];
    const params = [runId];
    
    nodeIds.forEach((nodeId, index) => {
      params.push(nodeId);
      values.push(`($1, $${index + 2}, 'pending')`);
    });
    
    const result = await query(
      `INSERT INTO node_executions (run_id, node_id, status) 
       VALUES ${values.join(', ')} RETURNING *`,
      params
    );
    return result.rows;
  },

  async getRunById(runId) {
    const result = await query(`SELECT * FROM workflow_runs WHERE id = $1`, [runId]);
    return result.rows[0];
  },

  async getRunsByWorkflowId(workflowId) {
    const result = await query(
      `SELECT * FROM workflow_runs WHERE workflow_id = $1 ORDER BY created_at DESC`,
      [workflowId]
    );
    return result.rows;
  },

  async getNodeExecutionsByRunId(runId) {
    const result = await query(
      `SELECT * FROM node_executions WHERE run_id = $1 ORDER BY started_at ASC NULLS LAST`,
      [runId]
    );
    return result.rows;
  },

  async getNodeExecution(runId, nodeId) {
    const result = await query(
      `SELECT * FROM node_executions WHERE run_id = $1 AND node_id = $2`,
      [runId, nodeId]
    );
    return result.rows[0];
  },

  async resetNodeExecution(runId, nodeId) {
    const result = await query(
      `UPDATE node_executions 
       SET status = 'pending', error = NULL, output = NULL, started_at = NULL, completed_at = NULL, retry_count = 0
       WHERE run_id = $1 AND node_id = $2
       RETURNING *`,
      [runId, nodeId]
    );
    return result.rows[0];
  }
};

module.exports = runModel;
