const BRAND = process.env.BRAND_NAME || "Priceless Bundle";
const MOMO_NUMBER = process.env.TOPUP_MOMO_NUMBER || "0XXXXXXXXX";
const MOMO_NAME = process.env.TOPUP_MOMO_NAME || BRAND;

function mainMenu() {
  return (
    `${BRAND} Menu\n` +
    `Hi, welcome.\n\n` +
    `1. Buy data\n` +
    `2. See prices\n` +
    `3. Track an order\n` +
    `4. Wallet balance\n` +
    `5. Top up wallet\n` +
    `6. Claim birthday gift 🎁\n` +
    `7. My referral code\n` +
    `8. Help\n\n` +
    `Type 0 anytime to cancel.`
  );
}

function chooseNetwork() {
  return `Choose network\n\n1. MTN\n2. AirtelTigo\n3. Telecel\n\n0. Back to menu`;
}

function bundleList(networkLabel, packages) {
  const lines = packages
    .map((p, i) => `${i + 1}. ${p.capacity}GB - GHS ${p.price}`)
    .join("\n");
  return `${networkLabel} bundles\n\n${lines}\n\n0. Back`;
}

function askRecipientNumber() {
  return `Send the phone number that should receive the data.`;
}

function confirmPurchase({ bundleLabel, networkLabel, phone, price, balance, balanceAfter }) {
  return (
    `Confirm wallet purchase\n\n` +
    `Bundle: ${bundleLabel} ${networkLabel}\n` +
    `Number: ${phone}\n` +
    `Price: GHS ${price.toFixed(2)}\n\n` +
    `Wallet: GHS ${balance.toFixed(2)} -> GHS ${balanceAfter.toFixed(2)}\n\n` +
    `1. Yes, pay from wallet\n` +
    `2. No, cancel`
  );
}

function insufficientBalance(balance, price) {
  return (
    `Insufficient balance.\n\n` +
    `Wallet: GHS ${balance.toFixed(2)}\n` +
    `Needed: GHS ${price.toFixed(2)}\n\n` +
    `Type 5 to see how to top up.\n\n` +
    `0. Back to menu`
  );
}

function topUpInstructions() {
  return (
    `💳 Top up your wallet\n\n` +
    `1. Send MoMo to: ${MOMO_NUMBER} (${MOMO_NAME})\n` +
    `2. Send us a screenshot or the transaction reference here in this chat\n` +
    `3. We'll confirm and credit your wallet — usually within a few minutes\n\n` +
    `Once credited, type "balance" to check, then 1 to buy data.`
  );
}

function orderSuccess({ bundleLabel, networkLabel, phone, price, balanceAfter, reference }) {
  return (
    `Order placed successfully ✅\n\n` +
    `Bundle: ${bundleLabel} ${networkLabel}\n` +
    `Number: ${phone}\n` +
    `Paid: GHS ${price.toFixed(2)}\n` +
    `Balance: GHS ${balanceAfter.toFixed(2)}\n` +
    `Ref: ${reference}\n\n` +
    `Track anytime: type "track ${reference}"`
  );
}

function orderFailed(reference) {
  return (
    `Something went wrong placing that order.\n` +
    (reference ? `Ref: ${reference}\n` : "") +
    `Your wallet was not charged. Please try again, or type 8 for help.`
  );
}

function giftAlreadyClaimed() {
  return `You've already claimed your birthday gift 🎁 — but you can still earn more by sharing your referral code! Type 7 to get it.`;
}

function giftSoldOut() {
  return `The birthday gift batch is fully claimed for now. Thanks for checking — stick around for the next promo!`;
}

function giftIntro() {
  return (
    `🎉 Birthday Gift 🎉\n\n` +
    `Get 1GB MTN data free.\n` +
    `To claim, reply with a referral code if someone shared one with you, ` +
    `or just reply "skip" to claim without one.`
  );
}

function giftClaimAskNumber() {
  return `Great! Send the phone number that should receive your free 1GB.`;
}

function giftClaimed({ phone, referralCode, gb, network }) {
  return (
    `🎁 Your free ${gb}GB ${network} bundle is on its way to ${phone}!\n\n` +
    `Here's YOUR referral code to share: ${referralCode}\n\n` +
    `When a friend uses it and makes their first purchase, you both get a reward. ` +
    `Share it in your status or a group chat!`
  );
}

function myReferralCode(code) {
  return (
    `Your referral code: ${code}\n\n` +
    `Share this with friends. When they buy their first bundle using your code, ` +
    `you both get a reward.`
  );
}

function help() {
  return (
    `Quick commands (type anytime):\n\n` +
    `menu — show main menu\n` +
    `prices — see all bundles\n` +
    `balance — wallet balance\n` +
    `topup — how to top up\n` +
    `track <ref> — track an order\n` +
    `0 — back / cancel\n\n` +
    `Need a human? Reply here and we'll get back to you.`
  );
}

module.exports = {
  mainMenu,
  chooseNetwork,
  bundleList,
  askRecipientNumber,
  confirmPurchase,
  insufficientBalance,
  topUpInstructions,
  orderSuccess,
  orderFailed,
  giftAlreadyClaimed,
  giftSoldOut,
  giftIntro,
  giftClaimAskNumber,
  giftClaimed,
  myReferralCode,
  help,
};
