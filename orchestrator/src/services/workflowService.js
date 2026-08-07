const workflowModel = require('../models/workflowModel');
const { AppError } = require('../middleware/errorHandler');

const VALID_NODE_TYPES = ['llm_call', 'condition', 'tool_call'];
const MAX_NODE_COUNT = 50; // per SECURITY.md §5 — prevent resource-exhaustion workflows

/**
 * Workflow service — business logic for CRUD + DAG validation.
 */
const workflowService = {
  async create(userId, name, dagDefinition) {
    this.validateDag(dagDefinition);
    return workflowModel.create(userId, name, dagDefinition);
  },

  async list(userId) {
    return workflowModel.findAllByUser(userId);
  },

  async getById(id, userId) {
    const workflow = await workflowModel.findById(id);
    if (!workflow) {
      throw new AppError('Workflow not found', 404, 'NOT_FOUND');
    }
    if (workflow.user_id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    return workflow;
  },

  async update(id, userId, fields) {
    // Re-validate DAG if it's being updated
    if (fields.dag_definition) {
      this.validateDag(fields.dag_definition);
    }

    const workflow = await workflowModel.update(id, userId, fields);
    if (!workflow) {
      // Could be not found or not owned — check which
      const existing = await workflowModel.findById(id);
      if (!existing) {
        throw new AppError('Workflow not found', 404, 'NOT_FOUND');
      }
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    return workflow;
  },

  async delete(id, userId) {
    const deleted = await workflowModel.deleteById(id, userId);
    if (!deleted) {
      const existing = await workflowModel.findById(id);
      if (!existing) {
        throw new AppError('Workflow not found', 404, 'NOT_FOUND');
      }
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
  },

  /**
   * Validate a DAG definition:
   * 1. Must have nodes and edges arrays
   * 2. All node types must be valid (llm_call, condition, tool_call)
   * 3. Max node count enforced
   * 4. Must be acyclic (topological sort)
   * 5. All edge references must point to existing node IDs
   */
  validateDag(dag) {
    if (!dag || !Array.isArray(dag.nodes) || !Array.isArray(dag.edges)) {
      throw new AppError(
        'dag_definition must have nodes[] and edges[] arrays',
        400,
        'INVALID_DAG',
      );
    }

    // Max node count
    if (dag.nodes.length > MAX_NODE_COUNT) {
      throw new AppError(
        `Workflow cannot exceed ${MAX_NODE_COUNT} nodes`,
        400,
        'DAG_TOO_LARGE',
      );
    }

    // Validate node types
    const nodeIds = new Set();
    for (const node of dag.nodes) {
      if (!node.id || typeof node.id !== 'string') {
        throw new AppError('Each node must have a string id', 400, 'INVALID_NODE');
      }
      if (!VALID_NODE_TYPES.includes(node.type)) {
        throw new AppError(
          `Invalid node type "${node.type}". Must be one of: ${VALID_NODE_TYPES.join(', ')}`,
          400,
          'INVALID_NODE_TYPE',
        );
      }
      if (nodeIds.has(node.id)) {
        throw new AppError(`Duplicate node id "${node.id}"`, 400, 'DUPLICATE_NODE_ID');
      }
      nodeIds.add(node.id);
    }

    // Validate edges reference existing nodes
    for (const edge of dag.edges) {
      if (!nodeIds.has(edge.source)) {
        throw new AppError(
          `Edge source "${edge.source}" references non-existent node`,
          400,
          'INVALID_EDGE',
        );
      }
      if (!nodeIds.has(edge.target)) {
        throw new AppError(
          `Edge target "${edge.target}" references non-existent node`,
          400,
          'INVALID_EDGE',
        );
      }
    }

    // Cycle detection via topological sort (Kahn's algorithm)
    if (!this.isAcyclic(dag.nodes, dag.edges)) {
      throw new AppError(
        'DAG contains a cycle — workflows must be acyclic',
        400,
        'CYCLIC_DAG',
      );
    }
  },

  /**
   * Cycle detection using Kahn's algorithm (topological sort).
   * Returns true if the graph is acyclic.
   */
  isAcyclic(nodes, edges) {
    const inDegree = new Map();
    const adjacency = new Map();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of edges) {
      adjacency.get(edge.source).push(edge.target);
      inDegree.set(edge.target, inDegree.get(edge.target) + 1);
    }

    // Start with nodes that have no incoming edges
    const queue = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    let processed = 0;
    while (queue.length > 0) {
      const current = queue.shift();
      processed++;

      for (const neighbor of adjacency.get(current)) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If we processed all nodes, the graph is acyclic
    return processed === nodes.length;
  },
};

module.exports = workflowService;
