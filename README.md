# Priceless Bundle WhatsApp Bot

A free, self-contained WhatsApp ordering bot — buy data bundles via
WhatsApp, paid from a wallet stored right inside the bot itself. No
website, no backend, no monthly fee. Built to get you live fast.

## How it works

1. **Customer sends you MoMo directly** to top up their wallet.
2. **You confirm it arrived, then credit their wallet manually** with one
   command from your own WhatsApp:
   `admin credit 0241234567 50`
3. **The bot handles everything else** — menu, bundle selection, wallet
   deduction, and the real DataMartGH purchase.

Wallet balances live in `data/wallets.json`, keyed directly by WhatsApp
number. No linking, no accounts, no website required.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: your DataMartGH API key, your MoMo number, your own WhatsApp
# number (for admin commands)
npm start
```

A QR code prints in the terminal. Scan it with the WhatsApp account you
want the bot to run on (Settings → Linked Devices → Link a Device).
`auth_session/` then holds the login — don't delete it, or you'll need to
re-scan.

## IMPORTANT before this touches real money

- **`lib/datamart.js`'s response shapes are assumed**, not confirmed
  against a live response. Log what `/data-packages` and `/purchase`
  actually return the first few times you call them, and adjust the
  `.packages` / `.reference` field access in `lib/datamart.js` and
  `lib/handler.js` if the real field names differ.
- **Test with tiny amounts first** — credit yourself GHS 5, buy the
  smallest bundle to a number you control, confirm it actually lands,
  before opening this to real customers.
- **`data/wallets.json` is a plain file** — back it up occasionally
  (copy it somewhere safe) so a server wipe doesn't lose customer
  balances. Move to a real database once you're getting steady volume.

## Admin commands (only work from numbers listed in ADMIN_NUMBERS)

```
admin credit 0241234567 50   -> adds GHS 50 to that number's wallet
```

This is how top-ups work until you build the SMS-forwarder auto-credit
system from your original plan — at that point, swap this manual step
for the forwarder calling `wallet.credit()` automatically.

## Customer commands

```
hi / menu       -> main menu
prices          -> see all bundles
balance         -> wallet balance
topup           -> how to top up
track <ref>     -> track an order
0               -> back / cancel
```

## Birthday gift + referral flow

- Menu option 6 claims a free 1GB MTN bundle (configurable in `.env`,
  funded by you — not from the claimer's wallet).
- Claiming generates a unique referral code (`PB-XXXX###`) for that user.
- If a new claimer enters someone else's code, that relationship is
  recorded in `lib/referral.js` (`referredBy` map).
- **Not yet wired up:** rewarding the referrer when their friend makes a
  first PAID purchase. `getReferrerToReward()` exists in `lib/referral.js`
  but nothing calls it yet — hook it into `handlePurchaseConfirm()` in
  `lib/handler.js` once you decide the reward (wallet credit, discount).
- **Referral data is in-memory** — resets if the bot restarts. Fine for
  testing today; move to a file or DB before relying on it long-term.

## Deploying on Render

1. Push this folder to GitHub.
2. New Web Service on Render, connect the repo.
3. Add a **persistent disk** mounted at the project root (or at least
   covering `auth_session/` and `data/`) so the WhatsApp login and wallet
   balances survive redeploys.
4. Add the environment variables from `.env.example`.
5. Deploy, check the **Logs** tab for the QR code, scan it.

## What's real vs. what to double-check

| File | Status |
|---|---|
| `lib/datamart.js` | Real endpoints from DataMartGH's docs, untested against live responses |
| `lib/wallet.js` | Fully working, self-contained (local JSON file) |
| `lib/admin.js` | Working — set your number in `ADMIN_NUMBERS` |
| `lib/referral.js` | Working logic, in-memory storage only |
| `lib/handler.js`, `lib/menu.js`, `lib/session.js`, `index.js` | Complete, ready to run |

## Later: connecting this to your website

When your website's wallet/login system is ready, you can link the two
by having the bot check the website's wallet FIRST and fall back to its
own local one — or migrate `data/wallets.json` balances into the website
database and point `lib/wallet.js` at it instead. That's a good next step
once the site is live, but not something you need today.
