const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  // SECURITY: redact fields matching key|token|password|secret per SECURITY.md §8
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.token',
      '*.refreshToken',
      '*.key',
      '*.secret',
      '*.encrypted_key',
    ],
    censor: '[REDACTED]',
  },
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

module.exports = logger;
