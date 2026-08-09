/**
 * Test setup — configure environment and provide test helpers.
 *
 * Tests mock the DB layer (no real Postgres needed for unit tests).
 * Integration tests requiring a real DB should use a separate test database.
 */

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test_db';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';

// Mock BullMQ to prevent actual Redis connections during tests
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue()
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue()
  }))
}));
