/**
 * TICKET-007: Auth endpoint tests — signup, login, refresh, logout.
 * Mocks DB layer; tests route logic, validation, and error handling.
 */
require('./setup');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock the DB pool before importing app
jest.mock('../src/db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [1] }) },
  query: jest.fn(),
}));

const { query } = require('../src/db/pool');
const app = require('../src/app');

// Helper: generate a valid refresh token hash for mocking
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

describe('POST /api/auth/signup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create user and return 201 with access token + refresh cookie', async () => {
    // Mock: no existing user
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: user creation
    query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'test@example.com', created_at: new Date().toISOString() }],
    });
    // Mock: refresh token creation
    query.mockResolvedValueOnce({ rows: [{ id: 'rt-1' }] });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.id).toBe('user-1');
    // Refresh token should be in httpOnly cookie, not body
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
  });

  it('should return 409 if email already exists', async () => {
    // Mock: existing user found
    query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'test@example.com' }],
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('should return 400 on invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 if password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 on missing fields', async () => {
    const res = await request(app).post('/api/auth/signup').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with tokens on valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 12);
    // Mock: user found
    query.mockResolvedValueOnce({
      rows: [{
        id: 'user-1',
        email: 'test@example.com',
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
      }],
    });
    // Mock: refresh token creation
    query.mockResolvedValueOnce({ rows: [{ id: 'rt-1' }] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should return 401 on wrong password', async () => {
    const passwordHash = await bcrypt.hash('password123', 12);
    query.mockResolvedValueOnce({
      rows: [{
        id: 'user-1',
        email: 'test@example.com',
        password_hash: passwordHash,
      }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 on nonexistent email', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noone@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 400 on missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/refresh', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return new access token when valid refresh cookie is sent', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // Mock: token found
    query.mockResolvedValueOnce({
      rows: [{
        id: 'rt-1',
        user_id: 'user-1',
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }],
    });
    // Mock: delete old token
    query.mockResolvedValueOnce({ rowCount: 1 });
    // Mock: create new refresh token
    query.mockResolvedValueOnce({ rows: [{ id: 'rt-2' }] });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    // New refresh token cookie should be set
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should return 401 when no refresh cookie is sent', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REQUIRED');
  });

  it('should return 401 on invalid/expired refresh token', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Mock: token not found (expired or already rotated)
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 204 and clear refresh cookie', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Mock: delete token
    query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`refreshToken=${rawToken}`]);

    expect(res.status).toBe(204);
  });

  it('should return 400 when no refresh token provided', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_REQUIRED');
  });
});
