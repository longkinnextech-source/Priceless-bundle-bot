const { getSession, setSession, resetSession } = require("./session");
const datamart = require("./datamart");
const wallet = require("./wallet");
const referral = require("./referral");
const admin = require("./admin");
const menu = require("./menu");

const NETWORK_LABELS = { "1": "MTN", "2": "AirtelTigo", "3": "Telecel" };
const NETWORK_CODE_BY_LABEL = {
  MTN: datamart.NETWORK_CODES.MTN,
  AirtelTigo: datamart.NETWORK_CODES.AIRTELTIGO,
  Telecel: datamart.NETWORK_CODES.TELECEL,
};

/**
 * Entry point: call this with every inbound WhatsApp message.
 * Returns the text to send back.
 */
async function handleMessage(userId, rawText) {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();
  const session = getSession(userId);

  // Global commands that work mid-flow, from anywhere.
  if (text === "0" || lower === "menu") {
    resetSession(userId);
    return menu.mainMenu();
  }
  if (lower.startsWith("admin credit ") && admin.isAdmin(userId)) {
    return await handleAdminCredit(text.slice(13).trim());
  }
  if (lower === "prices") return await sendAllPrices();
  if (lower === "balance") return await sendBalance(userId);
  if (lower === "topup" || lower === "top up") return menu.topUpInstructions();
  if (lower === "help") return menu.help();
  if (lower.startsWith("track ")) return await trackOrder(text.slice(6).trim());
  if (["hi", "hello", "hey", "start"].includes(lower) && session.step === "MENU") {
    return menu.mainMenu();
  }

  switch (session.step) {
    case "MENU":
      return await routeMainMenu(userId, text);

    case "BUY_NETWORK":
      return await handleNetworkChoice(userId, text);

    case "BUY_BUNDLE":
      return await handleBundleChoice(userId, text);

    case "BUY_NUMBER":
      return await handleRecipientNumber(userId, text);

    case "BUY_CONFIRM":
      return await handlePurchaseConfirm(userId, text);

    case "GIFT_CODE":
      return await handleGiftCode(userId, text);

    case "GIFT_NUMBER":
      return await handleGiftNumber(userId, text);

    default:
      resetSession(userId);
      return menu.mainMenu();
  }
}

async function routeMainMenu(userId, text) {
  switch (text) {
    case "1": // Buy data
      setSession(userId, { step: "BUY_NETWORK" });
      return menu.chooseNetwork();

    case "2": // See prices
      return await sendAllPrices();

    case "3": // Track order
      return `Reply with: track <reference>\ne.g. track WA-MN-ABC123XY`;

    case "4": // Wallet balance
      return await sendBalance(userId);

    case "5": // Top up
      return menu.topUpInstructions();

    case "6": // Claim birthday gift
      if (!referral.isGiftAvailable()) return menu.giftSoldOut();
      if (referral.hasClaimed(userId)) return menu.giftAlreadyClaimed();
      setSession(userId, { step: "GIFT_CODE" });
      return menu.giftIntro();

    case "7": { // My referral code
      const record = referral.hasClaimed(userId);
      if (!record) {
        return `You need to claim your birthday gift first to get a referral code. Type 6.`;
      }
      return menu.myReferralCode(record.code);
    }

    case "8":
      return menu.help();

    default:
      return `Sorry, I didn't get that.\n\n${menu.mainMenu()}`;
  }
}

// ---- Admin: manual wallet top-up ----
// Usage (from an ADMIN_NUMBERS phone only): admin credit 0241234567 50

async function handleAdminCredit(argsText) {
  const [rawPhone, rawAmount] = argsText.split(/\s+/);
  const phone = normalizePhone(rawPhone || "");
  const amount = Number(rawAmount);

  if (!phone || !amount || amount <= 0) {
    return `Usage: admin credit 0241234567 50`;
  }

  const result = await wallet.credit(phone, amount, "Manual top-up by admin");
  return `✅ Credited GHS ${amount.toFixed(2)} to ${phone}. New balance: GHS ${result.balance.toFixed(2)}`;
}

// ---- Buy data flow ----

async function handleNetworkChoice(userId, text) {
  const label = NETWORK_LABELS[text];
  if (!label) return `Please reply 1, 2 or 3.\n\n${menu.chooseNetwork()}`;

  const networkCode = NETWORK_CODE_BY_LABEL[label];
  let packages;
  try {
    const data = await datamart.getDataPackages(networkCode);
    packages = data.packages || data; // shape depends on their live API response
  } catch (err) {
    return `Couldn't load ${label} bundles right now. Please try again shortly.`;
  }

  setSession(userId, {
    step: "BUY_BUNDLE",
    data: { networkLabel: label, networkCode, packages },
  });
  return menu.bundleList(label, packages);
}

async function handleBundleChoice(userId, text) {
  const session = getSession(userId);
  const idx = Number(text) - 1;
  const packages = session.data.packages || [];
  const chosen = packages[idx];

  if (text === "0") {
    setSession(userId, { step: "BUY_NETWORK" });
    return menu.chooseNetwork();
  }
  if (!chosen) return `Please reply with a valid bundle number.\n\n${menu.bundleList(session.data.networkLabel, packages)}`;

  setSession(userId, { step: "BUY_NUMBER", data: { chosenBundle: chosen } });
  return menu.askRecipientNumber();
}

async function handleRecipientNumber(userId, text) {
  const phone = normalizePhone(text);
  if (!phone) return `That doesn't look like a valid phone number. Please try again.`;

  const session = getSession(userId);
  const { chosenBundle, networkLabel } = session.data;
  const price = Number(chosenBundle.price);

  let balance;
  try {
    balance = await wallet.getBalance(userId);
  } catch (err) {
    return `Couldn't check your wallet balance right now. Please try again shortly.`;
  }

  if (balance < price) {
    resetSession(userId);
    return menu.insufficientBalance(balance, price);
  }

  setSession(userId, { step: "BUY_CONFIRM", data: { recipientPhone: phone, balance } });
  return menu.confirmPurchase({
    bundleLabel: `${chosenBundle.capacity}GB`,
    networkLabel,
    phone,
    price,
    balance,
    balanceAfter: balance - price,
  });
}

async function handlePurchaseConfirm(userId, text) {
  const session = getSession(userId);
  const { chosenBundle, networkLabel, networkCode, recipientPhone, balance } = session.data;

  if (text === "2") {
    resetSession(userId);
    return `Order cancelled. Nothing was charged.\n\n${menu.mainMenu()}`;
  }
  if (text !== "1") {
    return `Reply 1 to pay from wallet, or 2 to cancel.`;
  }

  const price = Number(chosenBundle.price);
  const idempotencyKey = `${userId}-${Date.now()}`;

  // Deduct wallet FIRST, then attempt purchase. If purchase fails, refund.
  try {
    await wallet.deduct(userId, price, `Buy ${chosenBundle.capacity}GB ${networkLabel}`);
  } catch (err) {
    if (err.message === "INSUFFICIENT_FUNDS") {
      resetSession(userId);
      return menu.insufficientBalance(balance, price);
    }
    return `Couldn't deduct from your wallet. Please try again.`;
  }

  try {
    const order = await datamart.purchaseBundle({
      phoneNumber: recipientPhone,
      networkCode,
      capacityGB: chosenBundle.capacity,
      idempotencyKey,
    });

    resetSession(userId);
    return menu.orderSuccess({
      bundleLabel: `${chosenBundle.capacity}GB`,
      networkLabel,
      phone: recipientPhone,
      price,
      balanceAfter: balance - price,
      reference: order.reference || order.id || idempotencyKey,
    });
  } catch (err) {
    // Purchase failed after wallet was already deducted -> refund.
    try {
      await wallet.credit(userId, price, `Refund - failed order ${idempotencyKey}`);
    } catch (refundErr) {
      console.error("REFUND FAILED for", userId, idempotencyKey, refundErr.message);
    }
    resetSession(userId);
    return menu.orderFailed(idempotencyKey);
  }
}

// ---- Birthday gift flow ----

async function handleGiftCode(userId, text) {
  const lower = text.toLowerCase();
  let referralCodeUsed = null;

  if (lower !== "skip") {
    const referrerPhone = referral.findPhoneByCode(text);
    if (!referrerPhone) {
      return `That code wasn't found. Double-check it, or reply "skip" to claim without one.`;
    }
    referralCodeUsed = text.toUpperCase();
  }

  setSession(userId, { step: "GIFT_NUMBER", data: { referralCodeUsed } });
  return menu.giftClaimAskNumber();
}

async function handleGiftNumber(userId, text) {
  const phone = normalizePhone(text);
  if (!phone) return `That doesn't look like a valid phone number. Please try again.`;

  const session = getSession(userId);

  try {
    await datamart.purchaseBundle({
      phoneNumber: phone,
      networkCode: referral.GIFT_NETWORK_CODE,
      capacityGB: referral.GIFT_CAPACITY,
      idempotencyKey: `gift-${userId}-${Date.now()}`,
    });
  } catch (err) {
    return `Couldn't send your gift right now — please try again shortly, or type 8 for help.`;
  }

  const code = referral.claimGift(userId, session.data.referralCodeUsed);
  resetSession(userId);
  return menu.giftClaimed({
    phone,
    referralCode: code,
    gb: referral.GIFT_GB,
    network: referral.GIFT_NETWORK,
  });
}

// ---- Shared helpers ----

async function sendAllPrices() {
  try {
    const [mtn, at, telecel] = await Promise.all([
      datamart.getDataPackages(datamart.NETWORK_CODES.MTN),
      datamart.getDataPackages(datamart.NETWORK_CODES.AIRTELTIGO),
      datamart.getDataPackages(datamart.NETWORK_CODES.TELECEL),
    ]);
    const fmt = (label, data) => {
      const pkgs = data.packages || data;
      return `${label}:\n` + pkgs.map((p) => `${p.capacity}GB - GHS ${p.price}`).join("\n");
    };
    return [fmt("MTN", mtn), fmt("AirtelTigo", at), fmt("Telecel", telecel)].join("\n\n");
  } catch (err) {
    return `Couldn't load prices right now. Please try again shortly.`;
  }
}

async function sendBalance(userId) {
  try {
    const balance = await wallet.getBalance(userId);
    return `Wallet balance: GHS ${balance.toFixed(2)}`;
  } catch (err) {
    return `Couldn't check your balance right now. Please try again shortly.`;
  }
}

async function trackOrder(reference) {
  if (!reference) return `Please include a reference, e.g. track WA-MN-ABC123XY`;
  try {
    const status = await datamart.getOrderStatus(reference);
    return `Order ${reference}: ${status.status || "unknown"}`;
  } catch (err) {
    return `Couldn't find an order with reference ${reference}.`;
  }
}

function normalizePhone(text) {
  const digits = (text || "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return digits;
  if (digits.length === 12 && digits.startsWith("233")) return "0" + digits.slice(3);
  if (digits.length === 9) return "0" + digits;
  return null;
}

module.exports = { handleMessage };
