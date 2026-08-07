const { query } = require('../db/pool');

/**
 * User model — all queries parameterized, scoped by user_id where applicable.
 */
const userModel = {
  async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  },

  async findById(id) {
    const result = await query('SELECT id, email, created_at FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create(email, passwordHash) {
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash],
    );
    return result.rows[0];
  },
};

module.exports = userModel;
