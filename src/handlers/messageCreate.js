'use strict';

const { MessageFlags } = require('discord.js');
const { isOwner } = require('../utils/permissions');
const { buildHomeView } = require('../panel/views');
const { scanMessage } = require('../moderation/scanner');
const logger = require('../utils/logger');

function registerMessageHandlers(client, { configStore, strikesStore }) {
  const prefix = (process.env.PREFIX || '+').trim() || '+';
  const panelCommand = `${prefix}panel`;

  client.on('messageCreate', async (message) => {
    if (message.author?.bot) return;

    // Owner-only panel command. Checked before scanning so the command
    // text itself is never treated as an attachment-bearing message.
    if (message.guild && message.content.trim().toLowerCase() === panelCommand) {
      if (!isOwner(message.author.id)) return; // silent - no info leak
      try {
        await message.channel.send({
          components: buildHomeView(configStore.get()),
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        logger.error('messageCreate', 'Failed to send panel:', err.message);
      }
      return;
    }

    try {
      await scanMessage(message, { configStore, strikesStore });
    } catch (err) {
      logger.error('messageCreate', 'Scanner threw unexpectedly:', err.message);
    }
  });
}

module.exports = { registerMessageHandlers };
