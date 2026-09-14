// Birthday gift + referral system.
// In-memory for now (Map) — swap for a DB table when you're ready to scale
// or need it to survive a restart. Shape is simple on purpose:
//   claims:   phone -> { code, claimedAt }
//   referred: phone -> referrerPhone   (who invited this person)

const claims = new Map();
const referredBy = new Map();

const GIFT_ENABLED = String(process.env.BIRTHDAY_GIFT_ENABLED).toLowerCase() === "true";
const GIFT_GB = Number(process.env.BIRTHDAY_GIFT_GB || 1);
const GIFT_NETWORK = process.env.BIRTHDAY_GIFT_NETWORK || "MTN";
const GIFT_NETWORK_CODE = process.env.BIRTHDAY_GIFT_NETWORK_CODE || "YELLO";
const GIFT_CAPACITY = Number(process.env.BIRTHDAY_GIFT_CAPACITY || 1);
const MAX_CLAIMS = Number(process.env.BIRTHDAY_GIFT_MAX_CLAIMS || 100);

function makeReferralCode(phone) {
  // Short, shareable code derived from the phone's last 4 digits + random suffix.
  const last4 = phone.slice(-4);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `PB-${last4}${suffix}`;
}

function isGiftAvailable() {
  return GIFT_ENABLED && claims.size < MAX_CLAIMS;
}

function hasClaimed(phone) {
  return claims.has(phone);
}

/** Register a claim and hand back this user's own referral code to share. */
function claimGift(phone, referralCodeUsed) {
  const code = makeReferralCode(phone);
  claims.set(phone, { code, claimedAt: Date.now() });

  if (referralCodeUsed) {
    const referrerPhone = findPhoneByCode(referralCodeUsed);
    if (referrerPhone && referrerPhone !== phone) {
      referredBy.set(phone, referrerPhone);
    }
  }

  return code;
}

function findPhoneByCode(code) {
  for (const [phone, record] of claims.entries()) {
    if (record.code === code.toUpperCase()) return phone;
  }
  return null;
}

/** Call this after a REFERRED person's first paid purchase completes. */
function getReferrerToReward(phone) {
  return referredBy.get(phone) || null;
}

module.exports = {
  GIFT_GB,
  GIFT_NETWORK,
  GIFT_NETWORK_CODE,
  GIFT_CAPACITY,
  isGiftAvailable,
  hasClaimed,
  claimGift,
  findPhoneByCode,
  getReferrerToReward,
};
