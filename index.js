import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        auth: state,
        browser: ["Mac OS", "Chrome", "14.4.1"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log("📌 QR CODE À SCANNER :");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnexion…");
                startBot();
            } else {
                console.log("❌ Session expirée. Rescanne le QR.");
            }
        }

        if (connection === "open") {
            console.log("✅ Bot connecté à WhatsApp !");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        try {
            const response = await groq.chat.completions.create({
                model: "llama3-8b-8192",
                messages: [{ role: "user", content: text }]
            });

            const reply = response.choices[0].message.content;
            await sock.sendMessage(msg.key.remoteJid, { text: reply });
        } catch (err) {
            console.error("Erreur IA :", err);
        }
    });
}

startBot();
