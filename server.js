'use strict';

require('dotenv').config();

const express = require('express');
const { startBot } = require('./src/client');
const logger = require('./src/utils/logger');

const app = express();

app.get('/', (_req, res) => res.send('Sentinel is running.'));
app.get('/health', (_req, res) => res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info('server', `Health check listening on port ${PORT}.`));

startBot().catch((err) => {
  logger.error('server', 'Fatal error starting the bot:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('server', 'Unhandled promise rejection:', reason);
});
