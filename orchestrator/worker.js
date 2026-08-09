if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { Worker } = require('bullmq');
const { EXECUTE_NODE_QUEUE, redisOptions } = require('./src/services/queueService');
const { processNodeExecution } = require('./src/worker/processor');
const logger = require('./src/logger');

logger.info('Starting Worker Process...');

const worker = new Worker(EXECUTE_NODE_QUEUE, processNodeExecution, {
  connection: redisOptions,
  concurrency: 5 // Process up to 5 nodes concurrently per worker
});

worker.on('ready', () => {
  logger.info(`Worker connected to Redis and listening on queue: ${EXECUTE_NODE_QUEUE}`);
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'Worker encountered an error');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down worker...');
  await worker.close();
  process.exit(0);
});
