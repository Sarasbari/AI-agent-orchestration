const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

/**
 * Execute a parameterized query.
 * ALL queries MUST use this — no string concatenation into SQL, ever.
 */
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
