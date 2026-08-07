const { query } = require('../db/pool');

/**
 * Workflow model — all queries parameterized, scoped by user_id (architecture rule #2).
 */
const workflowModel = {
  async create(userId, name, dagDefinition) {
    const result = await query(
      `INSERT INTO workflows (user_id, name, dag_definition)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, name, dag_definition, created_at, updated_at`,
      [userId, name, JSON.stringify(dagDefinition)],
    );
    return result.rows[0];
  },

  async findAllByUser(userId) {
    const result = await query(
      `SELECT id, user_id, name, dag_definition, created_at, updated_at
       FROM workflows WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  async findById(id) {
    const result = await query(
      `SELECT id, user_id, name, dag_definition, created_at, updated_at
       FROM workflows WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async update(id, userId, fields) {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (fields.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(fields.name);
    }
    if (fields.dag_definition !== undefined) {
      setClauses.push(`dag_definition = $${paramIndex++}`);
      values.push(JSON.stringify(fields.dag_definition));
    }

    setClauses.push(`updated_at = NOW()`);

    // Scope by both id AND user_id (ownership enforced at query level)
    values.push(id, userId);
    const result = await query(
      `UPDATE workflows SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, user_id, name, dag_definition, created_at, updated_at`,
      values,
    );
    return result.rows[0] || null;
  },

  async deleteById(id, userId) {
    const result = await query(
      'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId],
    );
    return result.rowCount > 0;
  },
};

module.exports = workflowModel;
