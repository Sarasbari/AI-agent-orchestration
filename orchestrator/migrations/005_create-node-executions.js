/**
 * TICKET-002: Create node_executions table per TRD §2
 * Per-node execution status within a workflow run.
 */

exports.up = (pgm) => {
  pgm.createTable('node_executions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    run_id: {
      type: 'uuid',
      notNull: true,
      references: 'workflow_runs(id)',
      onDelete: 'CASCADE',
    },
    node_id: {
      type: 'varchar(50)',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
    },
    output: {
      type: 'jsonb',
    },
    error: {
      type: 'text',
    },
    started_at: {
      type: 'timestamptz',
    },
    completed_at: {
      type: 'timestamptz',
    },
    retry_count: {
      type: 'integer',
      default: 0,
    },
  });

  pgm.createIndex('node_executions', 'run_id', { name: 'idx_node_exec_run' });
};

exports.down = (pgm) => {
  pgm.dropTable('node_executions');
};
