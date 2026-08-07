const { z } = require('zod');

/**
 * Zod schemas for workflow validation.
 * DAG structure: { nodes: [{ id, type, config }], edges: [{ source, target }] }
 */

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['llm_call', 'condition', 'tool_call']),
  config: z.record(z.unknown()).optional().default({}),
});

const edgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
});

const dagDefinitionSchema = z.object({
  nodes: z.array(nodeSchema).min(1, 'Workflow must have at least one node'),
  edges: z.array(edgeSchema).default([]),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(255),
  dag_definition: dagDefinitionSchema,
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  dag_definition: dagDefinitionSchema.optional(),
});

module.exports = {
  createWorkflowSchema,
  updateWorkflowSchema,
  dagDefinitionSchema,
  nodeSchema,
  edgeSchema,
};
