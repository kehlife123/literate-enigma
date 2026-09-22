'use strict';

const logger = require('../utils/logger');
const { formatMinutes } = require('../utils/format');

/**
 * Record a strike for a user and, if this exact strike count matches a
 * configured ladder step, execute that step's punishment.
 *
 * Punishment only fires on an EXACT match to a step's `strikes` value, so a
 * user sitting above every threshold (e.g. already banned, or the owner
 * simply hasn't defined a step past 7) doesn't get re-punished on every
 * future flag - each step fires exactly once per user, the moment they
 * reach it.
 *
 * @returns {Promise<{count: number, action: string|null, detail: string|null, error: string|null}>}
 */
async function strikeAndPunish({ guild, userId, config, strikesStore, score, messageLink }) {
  const strikes = strikesStore.get();
  const entry = strikes[userId] || { count: 0, history: [] };
  entry.count += 1;
  entry.history = entry.history || [];

  const step = (config.ladder || []).find((s) => s.strikes === entry.count);

  let action = null;
  let detail = null;
  let error = null;

  if (step) {
    try {
      ({ action, detail } = await executeAction({ guild, userId, step }));
    } catch (err) {
      error = err.message || String(err);
      logger.error('punish', `Failed to execute "${step.action}" on ${userId}:`, error);
    }
  }

  entry.history.push({
    at: new Date().toISOString(),
    messageLink: messageLink || null,
    score,
    action,
  });
  // Keep history bounded so the file never grows unbounded for a spammer.
  if (entry.history.length > 50) entry.history = entry.history.slice(-50);

  strikesStore.update((data) => {
    data[userId] = entry;
    return data;
  });

  return { count: entry.count, action, detail, error };
}

async function executeAction({ guild, userId, step }) {
  switch (step.action) {
    case 'warn': {
      const detail = 'Sent a DM warning.';
      try {
        const user = await guild.client.users.fetch(userId);
        await user.send(
          `⚠️ You've received a moderation strike in **${guild.name}** for posting flagged content. Further violations may result in a timeout, kick, or ban.`
        );
      } catch {
        // DMs closed - not fatal, still counts as the warn step firing.
      }
      return { action: 'warn', detail };
    }
    case 'timeout': {
      const member = await guild.members.fetch(userId);
      const ms = Math.max(1, step.durationMinutes) * 60 * 1000;
      await member.timeout(ms, 'Sentinel: NSFW content strike ladder');
      return { action: 'timeout', detail: `Timed out for ${formatMinutes(step.durationMinutes)}.` };
    }
    case 'kick': {
      const member = await guild.members.fetch(userId);
      await member.kick('Sentinel: NSFW content strike ladder');
      return { action: 'kick', detail: 'Kicked from the server.' };
    }
    case 'ban': {
      await guild.members.ban(userId, { reason: 'Sentinel: NSFW content strike ladder' });
      return { action: 'ban', detail: 'Banned from the server.' };
    }
    default:
      throw new Error(`Unknown action "${step.action}"`);
  }
}

module.exports = { strikeAndPunish };
