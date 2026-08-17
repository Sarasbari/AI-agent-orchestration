/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */

exports.up = (pgm) => {
  // We need to drop dependent data first because we're changing the primary key type.
  pgm.dropTable('refresh_tokens', { ifExists: true });

  // Truncate other tables to easily change user_id data type
  pgm.sql('TRUNCATE TABLE node_executions CASCADE;');
  pgm.sql('TRUNCATE TABLE workflow_runs CASCADE;');
  pgm.sql('TRUNCATE TABLE workflows CASCADE;');
  pgm.sql('TRUNCATE TABLE api_keys CASCADE;');
  pgm.sql('TRUNCATE TABLE users CASCADE;');

  // Drop FK constraints
  pgm.dropConstraint('api_keys', 'api_keys_user_id_fkey', { ifExists: true });
  pgm.dropConstraint('workflows', 'workflows_user_id_fkey', { ifExists: true });

  // Modify users table
  pgm.dropColumn('users', 'password_hash');
  
  // Since we are changing PK, we need to drop the default and change type
  pgm.alterColumn('users', 'id', {
    type: 'varchar(255)',
    default: null,
  });

  // Modify foreign keys in other tables
  pgm.alterColumn('api_keys', 'user_id', {
    type: 'varchar(255)'
  });
  
  pgm.alterColumn('workflows', 'user_id', {
    type: 'varchar(255)'
  });

  // Re-add FK constraints
  pgm.addConstraint('api_keys', 'api_keys_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(id)',
      onDelete: 'CASCADE'
    }
  });
  pgm.addConstraint('workflows', 'workflows_user_id_fkey', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(id)',
      onDelete: 'CASCADE'
    }
  });
};

exports.down = (pgm) => {
  // Revert changes (destructive)
  pgm.sql('TRUNCATE TABLE node_executions CASCADE;');
  pgm.sql('TRUNCATE TABLE workflow_runs CASCADE;');
  pgm.sql('TRUNCATE TABLE workflows CASCADE;');
  pgm.sql('TRUNCATE TABLE api_keys CASCADE;');
  pgm.sql('TRUNCATE TABLE users CASCADE;');

  pgm.addColumns('users', {
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
      default: 'legacy_hash'
    }
  });

  pgm.alterColumn('workflow_runs', 'user_id', { type: 'uuid' });
  pgm.alterColumn('workflows', 'user_id', { type: 'uuid' });
  pgm.alterColumn('api_keys', 'user_id', { type: 'uuid' });
  
  pgm.alterColumn('users', 'id', {
    type: 'uuid',
    default: pgm.func('gen_random_uuid()'),
  });

  pgm.createTable('refresh_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    token: {
      type: 'varchar(512)',
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    revoked: {
      type: 'boolean',
      default: false,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('refresh_tokens', 'user_id');
  pgm.createIndex('refresh_tokens', 'token');
};
