/**
 * TICKET-002: Create api_keys table per TRD §2
 * Encrypted per-user API keys for LLM providers and tools.
 */

exports.up = (pgm) => {
  pgm.createTable('api_keys', {
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
    provider: {
      type: 'varchar(50)',
      notNull: true,
    },
    encrypted_key: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('now()'),
    },
  });

  // UNIQUE constraint: one key per provider per user
  pgm.addConstraint('api_keys', 'api_keys_user_provider_unique', {
    unique: ['user_id', 'provider'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('api_keys');
};
