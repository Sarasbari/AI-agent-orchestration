const express = require('express');
const authenticate = require('../middleware/authenticate');
const workflowService = require('../services/workflowService');
const runService = require('../services/runService');
const { createWorkflowSchema, updateWorkflowSchema } = require('../validators/workflowSchema');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// All workflow routes require authentication
router.use(authenticate);

/**
 * POST /api/workflows — Create a new workflow.
 * Validates DAG (cycle detection, node types) before saving.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, dag_definition } = createWorkflowSchema.parse(req.body);
    const workflow = await workflowService.create(req.user.id, name, dag_definition);
    res.status(201).json(workflow);
  }),
);

/**
 * GET /api/workflows — List user's workflows.
 * Scoped by user_id (architecture rule #2).
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const workflows = await workflowService.list(req.user.id);
    res.json(workflows);
  }),
);

/**
 * GET /api/workflows/:id — Get single workflow.
 * Ownership check enforced in service layer.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const workflow = await workflowService.getById(req.params.id, req.user.id);
    res.json(workflow);
  }),
);

/**
 * PUT /api/workflows/:id — Update workflow.
 * Re-validates DAG if dag_definition is changed.
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const fields = updateWorkflowSchema.parse(req.body);
    const workflow = await workflowService.update(req.params.id, req.user.id, fields);
    res.json(workflow);
  }),
);

/**
 * POST /api/workflows/:id/run — Trigger a new execution run of the workflow.
 */
router.post(
  '/:id/run',
  asyncHandler(async (req, res) => {
    const run = await runService.triggerRun(req.params.id, req.user.id);
    res.status(202).json(run); // 202 Accepted, execution is async
  }),
);

/**
 * DELETE /api/workflows/:id — Delete workflow.
 * Returns 204 on success.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await workflowService.delete(req.params.id, req.user.id);
    res.status(204).send();
  }),
);

/**
 * GET /api/workflows/:id/runs
 * Fetch the run history for a workflow
 */
router.get(
  '/:id/runs',
  asyncHandler(async (req, res) => {
    const workflow = await workflowService.getById(req.params.id, req.user.id);
    const runModel = require('../models/runModel');
    const runs = await runModel.getRunsByWorkflowId(workflow.id);
    res.json(runs);
  })
);

module.exports = router;
