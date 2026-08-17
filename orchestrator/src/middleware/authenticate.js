const { requireAuth } = require('@clerk/express');
const userModel = require('../models/userModel');

/**
 * Clerk authentication middleware + JIT database provisioning.
 * 1. requireAuth() verifies the JWT via Clerk (using CLERK_SECRET_KEY).
 * 2. ensureUser syncs the Clerk ID into our local Postgres DB.
 */

const authenticate = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth.userId;
      // We don't get the email automatically without fetching from Clerk API,
      // but we only really need the ID for foreign keys.
      // We'll just pass a placeholder email if they don't exist.
      await userModel.upsertUser(clerkId, `${clerkId}@placeholder.com`);
      
      // Map to req.user for backward compatibility with our route handlers
      req.user = { id: clerkId };
      next();
    } catch (err) {
      next(err);
    }
  }
];

module.exports = authenticate;
