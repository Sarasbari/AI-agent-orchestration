const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./logger');
const { errorHandler } = require('./middleware/errorHandler');
const { pool } = require('./db/pool');

const app = express();

// --- Core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger, autoLogging: config.NODE_ENV !== 'test' }));

// --- Health endpoints (K8s probes, per TRD §6) ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (_err) {
    res.status(503).json({
      error: { message: 'Database not ready', code: 'SERVICE_UNAVAILABLE' },
    });
  }
});

// --- API routes ---
const workflowRoutes = require('./routes/workflows');
const runRoutes = require('./routes/runs');
const keyRoutes = require('./routes/keys');

app.use('/api/workflows', workflowRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/keys', keyRoutes);

// --- Global error handler ---
app.use(errorHandler);

module.exports = app;
