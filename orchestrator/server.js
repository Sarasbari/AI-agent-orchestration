if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/logger');

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Orchestrator started');
});
