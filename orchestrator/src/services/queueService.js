const { Queue } = require('bullmq');
const config = require('../config');
const logger = require('../logger');

const redisOptions = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  maxRetriesPerRequest: null // Required by bullmq
};

const EXECUTE_NODE_QUEUE = 'execute-node';

const executeNodeQueue = new Queue(EXECUTE_NODE_QUEUE, {
  connection: redisOptions
});

executeNodeQueue.on('error', (err) => {
  logger.error({ err }, 'Queue connection error');
});

module.exports = {
  executeNodeQueue,
  EXECUTE_NODE_QUEUE,
  redisOptions
};
