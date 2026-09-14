require("dotenv").config();
const http = require("http");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { handleMessage } = require("./handler");

// Render's free "Web Service" tier requires something listening on
// process.env.PORT and responding to HTTP requests, or it marks the
// deploy as failed — even though this app's real job is the WhatsApp
// connection below, not a website. This tiny server exists purely to
// satisfy that check; it doesn't do anything else.
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Priceless Bundle WhatsApp bot is running.");
  })
  .listen(PORT, () => {
    console.log(`Keep-alive web server listening on port ${PORT}`);
  });

// Your own WhatsApp number, digits only with country code, no + and no
// spaces (e.g. "233205499441"). Used once, only if this is a fresh login,
// to request a pairing code instead of a QR code.
const PAIRING_PHONE_NUMBER = process.env.PAIRING_PHONE_NUMBER;

// Guards against requesting a NEW pairing code every time the socket
// reconnects — without this, each reconnect invalidated the previous
// code before you could type it in, which is why codes kept changing
// every few seconds in the logs.
let pairingRequested = false;

async function start() {
  // Session credentials are saved to disk here so you don't have to
  // re-link every time the bot restarts.
  const { state, saveCreds } = await useMultiFileAuthState("./auth_session");

  // Fixes the "405 / Connection Closed" loop on first connect — Baileys
  // needs to know WhatsApp's current protocol version, or the very
  // first handshake gets rejected and it loops forever.
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "120.0.0"],
    defaultQueryTimeoutMs: undefined,
  });

  // First-time setup: not yet linked to any WhatsApp account.
  if (!sock.authState.creds.registered && !pairingRequested) {
    if (!PAIRING_PHONE_NUMBER) {
      console.log(
        "\n⚠️  Not linked yet, and PAIRING_PHONE_NUMBER is not set in .env.\n" +
        "Set PAIRING_PHONE_NUMBER to your WhatsApp number (e.g. 233205499441) and restart.\n"
      );
    } else {
      pairingRequested = true;
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PAIRING_PHONE_NUMBER);
          console.log(`\n📱 Your WhatsApp pairing code: ${code}\n`);
          console.log(
            "On your phone: WhatsApp -> Settings -> Linked Devices -> Link a Device -> " +
            "'Link with phone number instead' -> enter this code within 60 seconds.\n"
          );
        } catch (err) {
          console.error("Failed to request pairing code:", err);
          pairingRequested = false; // allow a retry on the next reconnect
        }
      }, 3000);
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed.", statusCode, "Reconnecting:", shouldReconnect);
      if (shouldReconnect) {
        setTimeout(start, 2000); // brief pause before retrying
      }
    } else if (connection === "open") {
      pairingRequested = false; // reset so a future re-login can request again
      console.log("✅ Priceless Bundle WhatsApp bot is connected and ready.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const userId = msg.key.remoteJid;
      if (!userId || userId.endsWith("@g.us")) continue; // ignore group chats

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text) continue;

      try {
        const reply = await handleMessage(userId, text);
        if (reply) {
          await sock.sendMessage(userId, { text: reply });
        }
      } catch (err) {
        console.error("Error handling message from", userId, err);
        await sock.sendMessage(userId, {
          text: "Sorry, something went wrong. Please type 'menu' to start over.",
        });
      }
    }
  });
}

start().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
