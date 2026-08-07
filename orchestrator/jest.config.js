module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    '!src/logger.js',
  ],
  setupFiles: ['./tests/setup.js'],
  // Per TICKET-007: ≥80% coverage on auth + workflow routes
  coverageThreshold: {
    './src/routes/auth.js': {
      lines: 80,
      branches: 70,
    },
    './src/routes/workflows.js': {
      lines: 80,
      branches: 70,
    },
  },
};
