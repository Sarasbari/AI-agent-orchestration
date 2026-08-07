/**
 * Migration helper — loads dotenv and runs node-pg-migrate.
 * Usage: node scripts/migrate.js up|down
 */
require('dotenv').config();
const { execSync } = require('child_process');

const direction = process.argv[2] || 'up';
const allowed = ['up', 'down'];

if (!allowed.includes(direction)) {
  console.error(`Usage: node scripts/migrate.js [${allowed.join('|')}]`);
  process.exit(1);
}

try {
  execSync(`npx node-pg-migrate ${direction} --migrations-dir migrations`, {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  process.exit(1);
}
