require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { handleMessage } = require("./lib/handler");

// Your own WhatsApp number, digits only with country code, no + and no
// spaces (e.g. "233205499441"). Used once, only if this is a fresh login,
// to request a pairing code instead of a QR code — easier when you're
// setting this up from a phone with no separate screen to scan with.
const PAIRING_PHONE_NUMBER = process.env.PAIRING_PHONE_NUMBER;

async function start() {
  // Session credentials are saved to disk here so you don't have to
  // re-link every time the bot restarts.
  const { state, saveCreds } = await useMultiFileAuthState("./auth_session");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  // First-time setup: not yet linked to any WhatsApp account.
  if (!sock.authState.creds.registered) {
    if (!PAIRING_PHONE_NUMBER) {
      console.log(
        "\n⚠️  Not linked yet, and PAIRING_PHONE_NUMBER is not set in .env.\n" +
        "Set PAIRING_PHONE_NUMBER to your WhatsApp number (e.g. 233205499441) and restart.\n"
      );
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PAIRING_PHONE_NUMBER);
          console.log(`\n📱 Your WhatsApp pairing code: ${code}\n`);
          console.log(
            "On your phone: WhatsApp -> Settings -> Linked Devices -> Link a Device -> " +
            "'Link with phone number instead' -> enter this code.\n"
          );
        } catch (err) {
          console.error("Failed to request pairing code:", err);
        }
      }, 3000); // small delay so the socket is fully ready first
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed.", statusCode, "Reconnecting:", shouldReconnect);
      if (shouldReconnect) start();
    } else if (connection === "open") {
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
