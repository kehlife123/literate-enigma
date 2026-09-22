'use strict';

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const { formatScore } = require('../utils/format');
const logger = require('../utils/logger');

/**
 * Send a styled log entry to the configured mod-log channel, with the
 * flagged frame attached inline so the owner can see exactly what tripped
 * the filter without leaving Discord.
 */
async function sendLogEntry(guild, config, {
  authorId,
  channelId,
  messageLink,
  score,
  strikeCount,
  actionResult,
  previewBuffer,
  previewName,
  wasDeleted,
}) {
  if (!config.logChannelId) return;
  const channel = await guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    logger.warn('log-entry', 'Configured log channel is missing or not text-based; skipping log.');
    return;
  }

  const lines = [
    '## 🚩 Flagged content',
    `**User:** <@${authorId}> (\`${authorId}\`)`,
    `**Channel:** <#${channelId}>`,
    `**Score:** ${formatScore(score)} (threshold ${formatScore(config.threshold)})`,
    `**Message deleted:** ${wasDeleted ? 'Yes' : 'No'}`,
    `**Strike count:** ${strikeCount}`,
  ];

  if (messageLink) lines.push(`**Original message:** ${messageLink}`);

  if (actionResult?.action) {
    lines.push(`**Punishment fired:** ${actionResult.detail || actionResult.action}`);
  }
  if (actionResult?.error) {
    lines.push(`**Punishment error:** ${actionResult.error}`);
  }

  const container = new ContainerBuilder().setAccentColor(0xed4245);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

  const files = [];
  if (previewBuffer) {
    const filename = previewName || 'preview.png';
    files.push(new AttachmentBuilder(previewBuffer, { name: filename }));
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(`attachment://${filename}`).setDescription('Flagged content preview')
      )
    );
  }

  await channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    files,
  });
}

module.exports = { sendLogEntry };
