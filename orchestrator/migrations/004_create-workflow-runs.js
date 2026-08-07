/**
 * TICKET-002: Create workflow_runs table per TRD §2
 * Tracks execution runs of workflows.
 */

exports.up = (pgm) => {
  pgm.createTable('workflow_runs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    workflow_id: {
      type: 'uuid',
      notNull: true,
      references: 'workflows(id)',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
    },
    started_at: {
      type: 'timestamptz',
    },
    completed_at: {
      type: 'timestamptz',
    },
    error: {
      type: 'text',
    },
  });

  pgm.createIndex('workflow_runs', 'workflow_id', { name: 'idx_runs_workflow' });
};

exports.down = (pgm) => {
  pgm.dropTable('workflow_runs');
};
