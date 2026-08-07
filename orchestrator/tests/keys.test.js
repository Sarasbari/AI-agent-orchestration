/**
 * TICKET-007: API key vault endpoint tests.
 * Mocks DB layer; tests encryption, route logic, and security invariants.
 */
require('./setup');

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the DB pool before importing app
jest.mock('../src/db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [1] }) },
  query: jest.fn(),
}));

const { query } = require('../src/db/pool');
const app = require('../src/app');

const makeToken = (userId = 'user-1') => {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
};

describe('POST /api/keys', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should encrypt and store key, return 201 without raw key', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'key-1',
        user_id: 'user-1',
        provider: 'groq',
        created_at: new Date().toISOString(),
      }],
    });

    const res = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ provider: 'groq', key: 'gsk_test_key_12345' });

    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('groq');
    expect(res.body.id).toBe('key-1');
    // CRITICAL: raw key must NOT be in response
    expect(res.body.key).toBeUndefined();
    expect(res.body.encrypted_key).toBeUndefined();

    // Verify the DB received an encrypted value (not raw)
    const dbCall = query.mock.calls[0];
    const storedEncrypted = dbCall[1][2]; // 3rd param is encrypted_key
    expect(storedEncrypted).not.toBe('gsk_test_key_12345');
    expect(storedEncrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/); // iv:authTag:ciphertext
  });

  it('should return 409 on duplicate provider for same user', async () => {
    query.mockRejectedValueOnce({ code: '23505' }); // PG unique constraint

    const res = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ provider: 'groq', key: 'some-key' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE');
  });

  it('should return 400 on missing provider', async () => {
    const res = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ key: 'some-key' });

    expect(res.status).toBe(400);
  });

  it('should return 400 on missing key', async () => {
    const res = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ provider: 'groq' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .post('/api/keys')
      .send({ provider: 'groq', key: 'some-key' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/keys', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return provider and created_at only, never raw key', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 'k1', provider: 'groq', created_at: '2026-08-01' },
        { id: 'k2', provider: 'gemini', created_at: '2026-08-02' },
      ],
    });

    const res = await request(app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].provider).toBe('groq');
    // CRITICAL: no raw key or encrypted key in response
    res.body.forEach((k) => {
      expect(k.key).toBeUndefined();
      expect(k.encrypted_key).toBeUndefined();
    });
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/keys');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/keys/:provider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should delete key and return 204', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'k1' }] });

    const res = await request(app)
      .delete('/api/keys/groq')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(204);
  });

  it('should return 404 if key not found for provider', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .delete('/api/keys/nonexistent')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).delete('/api/keys/groq');
    expect(res.status).toBe(401);
  });
});
