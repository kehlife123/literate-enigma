'use strict';

/** Valid actions for a punishment-ladder step. */
const ACTIONS = ['warn', 'timeout', 'kick', 'ban'];

/** Named sensitivity presets mapped to an NSFW score threshold (0-1, lower = stricter). */
const SENSITIVITY_PRESETS = {
  Low: 0.85,
  Medium: 0.75,
  High: 0.6,
};

const DEFAULT_CONFIG = {
  // Master switch. When false, no messages are scanned at all.
  enabled: true,

  // Channel that receives every flag (image + score + action taken).
  logChannelId: null,

  // Delete the offending message the moment it's flagged.
  deleteOnFlag: true,

  // 0-1 combined NSFW score required to flag content. Lower = stricter.
  threshold: SENSITIVITY_PRESETS.Medium,
  sensitivityLabel: 'Medium',

  // How many frames to sample from an animated GIF before giving up.
  gifSampleFrames: 4,

  // Escalating punishments. Sorted ascending by `strikes` on every save.
  // action: 'warn' | 'timeout' | 'kick' | 'ban'
  // durationMinutes: only used when action === 'timeout'
  ladder: [
    { strikes: 1, action: 'warn' },
    { strikes: 3, action: 'timeout', durationMinutes: 60 },
    { strikes: 5, action: 'kick' },
    { strikes: 7, action: 'ban' },
  ],

  // Channels/roles that are never scanned (IDs).
  ignoredChannelIds: [],
  ignoredRoleIds: [],
};

const DEFAULT_STRIKES = {
  // userId: { count: number, history: [{ at: isoString, messageLink: string|null, action: string|null, score: number }] }
};

module.exports = { ACTIONS, SENSITIVITY_PRESETS, DEFAULT_CONFIG, DEFAULT_STRIKES };
