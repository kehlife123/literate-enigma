'use strict';

/** "1h 30m", "45m", "90s" style duration formatting from a minute count. */
function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Render a 0-1 score as a whole-number percentage string, e.g. "0.734" -> "73%". */
function formatScore(score) {
  return `${Math.round(score * 100)}%`;
}

/** Describe a single ladder step in one line, e.g. "Strike 3 -> Timeout (1h)". */
function describeStep(step) {
  const label = step.action.charAt(0).toUpperCase() + step.action.slice(1);
  if (step.action === 'timeout') {
    return `Strike ${step.strikes} → ${label} (${formatMinutes(step.durationMinutes)})`;
  }
  return `Strike ${step.strikes} → ${label}`;
}

/** Short ISO-ish timestamp for logs, in the server's local rendering (Discord handles display). */
function nowIso() {
  return new Date().toISOString();
}

module.exports = { formatMinutes, formatScore, describeStep, nowIso };
