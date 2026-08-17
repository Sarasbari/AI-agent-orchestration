const { query } = require('../db/pool');

/**
 * User model — all queries parameterized, scoped by user_id where applicable.
 */
const userModel = {
  async upsertUser(id, email) {
    const result = await query(
      `INSERT INTO users (id, email) 
       VALUES ($1, $2) 
       ON CONFLICT (id) DO NOTHING 
       RETURNING id, email`,
      [id, email]
    );
    return result.rows[0];
  }
};

module.exports = userModel;
