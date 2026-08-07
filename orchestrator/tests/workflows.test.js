/**
 * TICKET-007: Workflow CRUD endpoint tests.
 * Mocks DB layer; tests route logic, DAG validation, ownership checks.
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

// Helper: generate a valid JWT for testing
const makeToken = (userId = 'user-1') => {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
};

// Helper: valid DAG fixture
const validDag = {
  nodes: [
    { id: 'node-1', type: 'llm_call', config: { prompt: 'Hello' } },
    { id: 'node-2', type: 'condition', config: { if: 'output.length > 0' } },
    { id: 'node-3', type: 'tool_call', config: { tool: 'send_email' } },
  ],
  edges: [
    { source: 'node-1', target: 'node-2' },
    { source: 'node-2', target: 'node-3' },
  ],
};

// Helper: cyclic DAG
const cyclicDag = {
  nodes: [
    { id: 'a', type: 'llm_call' },
    { id: 'b', type: 'llm_call' },
    { id: 'c', type: 'llm_call' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'a' }, // cycle!
  ],
};

describe('POST /api/workflows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create workflow and return 201', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'wf-1',
        user_id: 'user-1',
        name: 'Test Workflow',
        dag_definition: validDag,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
    });

    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Test Workflow', dag_definition: validDag });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Workflow');
    expect(res.body.id).toBe('wf-1');
  });

  it('should return 400 on cyclic DAG', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Cyclic', dag_definition: cyclicDag });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CYCLIC_DAG');
  });

  it('should return 400 on invalid node type', async () => {
    const invalidDag = {
      nodes: [{ id: 'n1', type: 'invalid_type' }],
      edges: [],
    };

    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Invalid', dag_definition: invalidDag });

    expect(res.status).toBe(400);
  });

  it('should return 400 on missing name', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ dag_definition: validDag });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .send({ name: 'Test', dag_definition: validDag });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/workflows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return only user\'s workflows', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 'wf-1', user_id: 'user-1', name: 'WF1', dag_definition: validDag },
        { id: 'wf-2', user_id: 'user-1', name: 'WF2', dag_definition: validDag },
      ],
    });

    const res = await request(app)
      .get('/api/workflows')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Verify query was called with user_id
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('user_id'),
      ['user-1'],
    );
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/workflows');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/workflows/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return workflow if owned by user', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'wf-1', user_id: 'user-1', name: 'Test', dag_definition: validDag,
      }],
    });

    const res = await request(app)
      .get('/api/workflows/wf-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('wf-1');
  });

  it('should return 403 if workflow owned by another user', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'wf-1', user_id: 'other-user', name: 'Test' }],
    });

    const res = await request(app)
      .get('/api/workflows/wf-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should return 404 if workflow does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/workflows/nonexistent')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PUT /api/workflows/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should update workflow and return 200', async () => {
    // Mock: update succeeds (scoped by user_id)
    query.mockResolvedValueOnce({
      rows: [{
        id: 'wf-1',
        user_id: 'user-1',
        name: 'Updated',
        dag_definition: validDag,
        updated_at: new Date().toISOString(),
      }],
    });

    const res = await request(app)
      .put('/api/workflows/wf-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('should return 400 on cyclic DAG update', async () => {
    const res = await request(app)
      .put('/api/workflows/wf-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ dag_definition: cyclicDag });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CYCLIC_DAG');
  });

  it('should return 403 if not owned by user', async () => {
    // Mock: update returns nothing (user_id mismatch in WHERE clause)
    query.mockResolvedValueOnce({ rows: [] });
    // Mock: findById check shows it exists but owned by someone else
    query.mockResolvedValueOnce({
      rows: [{ id: 'wf-1', user_id: 'other-user' }],
    });

    const res = await request(app)
      .put('/api/workflows/wf-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/workflows/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should delete workflow and return 204', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'wf-1' }] });

    const res = await request(app)
      .delete('/api/workflows/wf-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(204);
  });

  it('should return 403 if not owned by user', async () => {
    // Delete returns 0 (user_id mismatch)
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    // findById check
    query.mockResolvedValueOnce({
      rows: [{ id: 'wf-1', user_id: 'other-user' }],
    });

    const res = await request(app)
      .delete('/api/workflows/wf-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 if workflow does not exist', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/workflows/nonexistent')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});
