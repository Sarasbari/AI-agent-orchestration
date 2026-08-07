/**
 * TICKET-002: Create workflows table per TRD §2
 * Stores workflow definitions with JSONB dag_definition.
 */

exports.up = (pgm) => {
  pgm.createTable('workflows', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    dag_definition: {
      type: 'jsonb',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('now()'),
    },
  });

  // Index for user-scoped queries (architecture rule #2)
  pgm.createIndex('workflows', 'user_id', { name: 'idx_workflows_user' });
};

exports.down = (pgm) => {
  pgm.dropTable('workflows');
};
