// Self-contained wallet — no website, no backend, no linking needed.
// Balances are stored directly against the WhatsApp number in a local
// JSON file (data/wallets.json). Good enough to launch today; swap for a
// real database later if you want it to survive server wipes / scale up.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "wallets.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

// Simple queue so two messages arriving at nearly the same instant can't
// both read the same balance before either write lands (avoids a race
// where someone could spend money twice).
let queue = Promise.resolve();
function serialize(fn) {
  const result = queue.then(fn);
  queue = result.catch(() => {}); // don't let one failure jam the queue
  return result;
}

async function getBalance(phone) {
  return serialize(() => {
    const store = readStore();
    return store[phone]?.balance || 0;
  });
}

async function deduct(phone, amountGHS, reason) {
  return serialize(() => {
    const store = readStore();
    const current = store[phone]?.balance || 0;
    if (current < amountGHS) {
      throw new Error("INSUFFICIENT_FUNDS");
    }
    const newBalance = round2(current - amountGHS);
    store[phone] = store[phone] || { balance: 0, history: [] };
    store[phone].balance = newBalance;
    store[phone].history = store[phone].history || [];
    store[phone].history.push({ amount: -amountGHS, reason, at: new Date().toISOString() });
    writeStore(store);
    return { balance: newBalance, ok: true };
  });
}

async function credit(phone, amountGHS, reason) {
  return serialize(() => {
    const store = readStore();
    const current = store[phone]?.balance || 0;
    const newBalance = round2(current + amountGHS);
    store[phone] = store[phone] || { balance: 0, history: [] };
    store[phone].balance = newBalance;
    store[phone].history = store[phone].history || [];
    store[phone].history.push({ amount: amountGHS, reason, at: new Date().toISOString() });
    writeStore(store);
    return { balance: newBalance, ok: true };
  });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { getBalance, deduct, credit };
