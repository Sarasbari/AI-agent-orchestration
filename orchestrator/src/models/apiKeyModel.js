const { query } = require('../db/pool');

/**
 * API key model — all queries parameterized, scoped by user_id.
 * Per architecture rule #3: raw keys never in responses, logs, or errors.
 */
const apiKeyModel = {
  async create(userId, provider, encryptedKey) {
    const result = await query(
      `INSERT INTO api_keys (user_id, provider, encrypted_key)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, provider, created_at`,
      [userId, provider, encryptedKey],
    );
    return result.rows[0];
  },

  /**
   * List keys — returns provider + created_at only, NEVER raw/encrypted key.
   */
  async findAllByUser(userId) {
    const result = await query(
      'SELECT id, provider, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows;
  },

  /**
   * Get encrypted key for a specific provider (used by workers for LLM calls).
   */
  async findByUserAndProvider(userId, provider) {
    const result = await query(
      'SELECT encrypted_key FROM api_keys WHERE user_id = $1 AND provider = $2',
      [userId, provider],
    );
    return result.rows[0] || null;
  },

  async deleteByUserAndProvider(userId, provider) {
    const result = await query(
      'DELETE FROM api_keys WHERE user_id = $1 AND provider = $2 RETURNING id',
      [userId, provider],
    );
    return result.rowCount > 0;
  },
};

module.exports = apiKeyModel;
