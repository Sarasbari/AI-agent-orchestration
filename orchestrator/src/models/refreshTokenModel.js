const { query } = require('../db/pool');

/**
 * Refresh token model — stores hashed tokens for JWT rotation.
 * Per SECURITY.md §2: rotation, reuse detection, session family revocation.
 */
const refreshTokenModel = {
  async create(userId, tokenHash, expiresAt) {
    const result = await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id',
      [userId, tokenHash, expiresAt],
    );
    return result.rows[0];
  },

  async findByHash(tokenHash) {
    const result = await query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash],
    );
    return result.rows[0] || null;
  },

  async deleteByHash(tokenHash) {
    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  },

  /**
   * Revoke entire session family — delete ALL refresh tokens for a user.
   * Triggered on reuse detection per SECURITY.md §2.
   */
  async deleteAllForUser(userId) {
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  },

  /**
   * Clean up expired tokens (housekeeping).
   */
  async deleteExpired() {
    await query('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
  },
};

module.exports = refreshTokenModel;
