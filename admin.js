// Until the SMS-forwarder auto-credit system is built, you top up
// customer wallets manually: they send you MoMo directly, you confirm it
// arrived, then send the bot a command from YOUR OWN WhatsApp number to
// credit their wallet.

const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || "")
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean);

function isAdmin(userId) {
  // userId looks like "233241234567@s.whatsapp.net" — compare against the
  // digits you listed in ADMIN_NUMBERS (just the phone number, no suffix).
  const digits = userId.split("@")[0];
  return ADMIN_NUMBERS.includes(digits);
}

module.exports = { isAdmin };
