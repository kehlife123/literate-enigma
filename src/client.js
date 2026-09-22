'use strict';

const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { JsonStore } = require('./storage/store');
const { DEFAULT_CONFIG, DEFAULT_STRIKES } = require('./config/defaults');
const { registerMessageHandlers } = require('./handlers/messageCreate');
const { registerInteractionHandlers } = require('./handlers/interactionCreate');
const { loadModel } = require('./moderation/classifier');
const logger = require('./utils/logger');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function startBot() {
  const token = requireEnv('DISCORD_TOKEN');
  requireEnv('OWNER_ID');

  const dataDir = process.env.DATA_DIR || './data';
  const configStore = new JsonStore(path.resolve(dataDir, 'config.json'), DEFAULT_CONFIG);
  const strikesStore = new JsonStore(path.resolve(dataDir, 'strikes.json'), DEFAULT_STRIKES);
  // Make sure both files exist on disk from the very first boot.
  configStore.save();
  strikesStore.save();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  registerMessageHandlers(client, { configStore, strikesStore });
  registerInteractionHandlers(client, { configStore, strikesStore });

  client.once('clientReady', () => {
    logger.info('client', `Logged in as ${client.user.tag}. Owner-only panel prefix: "${process.env.PREFIX || '+'}panel".`);
  });

  client.on('error', (err) => logger.error('client', 'Discord client error:', err.message));

  // Warm up the NSFW model in the background so the very first flagged
  // image doesn't pay the model-load latency cost.
  loadModel().catch((err) => logger.error('client', 'Failed to preload NSFW model:', err.message));

  await client.login(token);
  return client;
}

module.exports = { startBot };
