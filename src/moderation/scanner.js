'use strict';

const { classifyImageBuffer } = require('./classifier');
const { sampleFrames } = require('./frames');
const { strikeAndPunish } = require('./punish');
const { sendLogEntry } = require('./logEntry');
const logger = require('../utils/logger');

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** Fetch an attachment's bytes. Discord CDN URLs need no auth. */
async function downloadAttachment(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Attachment download failed: HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Classify one attachment (static image or animated GIF) and return the
 * worst (highest) score found, plus a representative preview buffer for
 * the log entry.
 */
async function classifyAttachment(attachment, config) {
  const buffer = await downloadAttachment(attachment.url);

  if (attachment.contentType === 'image/gif') {
    const frames = await sampleFrames(buffer, config.gifSampleFrames || 4);
    let best = { score: 0, preview: frames[0] };
    for (const frame of frames) {
      // eslint-disable-next-line no-await-in-loop
      const { score } = await classifyImageBuffer(frame);
      if (score > best.score) best = { score, preview: frame };
    }
    return { score: best.score, previewBuffer: best.preview, previewName: 'flagged-frame.png' };
  }

  const { score } = await classifyImageBuffer(buffer);
  return { score, previewBuffer: buffer, previewName: attachment.name || 'flagged-image.png' };
}

function memberHasIgnoredRole(member, ignoredRoleIds) {
  if (!ignoredRoleIds || ignoredRoleIds.length === 0) return false;
  return member?.roles?.cache?.some((role) => ignoredRoleIds.includes(role.id)) ?? false;
}

/**
 * Entry point wired to messageCreate. Scans every image/GIF attachment on
 * the message; on the first flagged attachment it deletes (if configured),
 * strikes the author, fires any punishment step that was just reached, and
 * logs the result. Remaining attachments on the same message are skipped
 * once a flag has already been actioned, to avoid double-punishing a
 * single message.
 */
async function scanMessage(message, { configStore, strikesStore }) {
  const config = configStore.get();
  if (!config.enabled) return;
  if (!message.guild || message.author?.bot) return;
  if (message.attachments.size === 0) return;
  if (config.ignoredChannelIds?.includes(message.channelId)) return;
  if (memberHasIgnoredRole(message.member, config.ignoredRoleIds)) return;

  const imageAttachments = [...message.attachments.values()].filter((a) =>
    IMAGE_TYPES.has(a.contentType)
  );
  if (imageAttachments.length === 0) return;

  for (const attachment of imageAttachments) {
    let result;
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await classifyAttachment(attachment, config);
    } catch (err) {
      logger.error('scanner', `Failed to classify attachment ${attachment.id}:`, err.message);
      continue;
    }

    if (result.score < config.threshold) continue;

    // Flagged. Take action on this message and stop checking further attachments on it.
    const messageLink = message.url;
    let wasDeleted = false;
    if (config.deleteOnFlag) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await message.delete();
        wasDeleted = true;
      } catch (err) {
        logger.warn('scanner', `Could not delete flagged message ${message.id}:`, err.message);
      }
    }

    let actionResult = { count: 0, action: null, detail: null, error: null };
    try {
      // eslint-disable-next-line no-await-in-loop
      actionResult = await strikeAndPunish({
        guild: message.guild,
        userId: message.author.id,
        config,
        strikesStore,
        score: result.score,
        messageLink,
      });
    } catch (err) {
      logger.error('scanner', 'Failed to apply strike/punishment:', err.message);
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await sendLogEntry(message.guild, config, {
        authorId: message.author.id,
        channelId: message.channelId,
        messageLink: wasDeleted ? null : messageLink,
        score: result.score,
        strikeCount: actionResult.count,
        actionResult,
        previewBuffer: result.previewBuffer,
        previewName: result.previewName,
        wasDeleted,
      });
    } catch (err) {
      logger.error('scanner', 'Failed to send log entry:', err.message);
    }

    return; // one flag per message is enough
  }
}

module.exports = { scanMessage };
