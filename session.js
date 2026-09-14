// Simple in-memory session store: one conversation "state" per WhatsApp number.
// Good enough to start. If you restart the bot, active sessions reset to the
// main menu (nobody loses money — nothing is charged until final confirm).
//
// When you're ready to scale, swap this Map for Redis or a DB table keyed
// by phone number, keeping the same get/set/clear interface.

const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { step: "MENU", data: {} });
  }
  return sessions.get(userId);
}

function setSession(userId, patch) {
  const current = getSession(userId);
  const next = { ...current, ...patch, data: { ...current.data, ...(patch.data || {}) } };
  sessions.set(userId, next);
  return next;
}

function resetSession(userId) {
  sessions.set(userId, { step: "MENU", data: {} });
}

module.exports = { getSession, setSession, resetSession };
