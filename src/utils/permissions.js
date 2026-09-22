'use strict';

/**
 * The bot is intentionally single-operator: only the configured OWNER_ID
 * may open the panel or interact with any of its components. Everyone
 * else's interactions are rejected silently (no information leak about
 * what the panel contains).
 */
function isOwner(userId) {
  return typeof userId === 'string' && userId === process.env.OWNER_ID;
}

module.exports = { isOwner };
