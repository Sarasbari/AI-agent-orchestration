const express = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const encryptionService = require('../services/encryptionService');
const apiKeyModel = require('../models/apiKeyModel');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// All key routes require authentication
router.use(authenticate);

// --- Zod schemas ---
const createKeySchema = z.object({
  provider: z.string().min(1, 'Provider is required').max(50),
  key: z.string().min(1, 'API key is required'),
});

/**
 * POST /api/keys — Store an encrypted API key for a provider.
 * Encrypts with AES-256-GCM before storage. Raw key NEVER persisted.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { provider, key } = createKeySchema.parse(req.body);
    const encryptedKey = encryptionService.encrypt(key);
    const apiKey = await apiKeyModel.create(req.user.id, provider, encryptedKey);

    res.status(201).json(apiKey); // Returns id, provider, created_at — NOT the key
  }),
);

/**
 * GET /api/keys — List user's API keys.
 * Returns provider + created_at only, NEVER the raw key.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const keys = await apiKeyModel.findAllByUser(req.user.id);
    res.json(keys);
  }),
);

/**
 * DELETE /api/keys/:provider — Remove a provider's API key.
 * Scoped by user_id.
 */
router.delete(
  '/:provider',
  asyncHandler(async (req, res) => {
    const deleted = await apiKeyModel.deleteByUserAndProvider(req.user.id, req.params.provider);
    if (!deleted) {
      throw new AppError('API key not found for this provider', 404, 'NOT_FOUND');
    }
    res.status(204).send();
  }),
);

module.exports = router;
