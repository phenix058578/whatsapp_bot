import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import Groq from "groq-sdk";

// Initialisation de l'IA Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY, // La clé sera mise dans Render
});

// Fonction IA
async function askGroq(question) {
    try {
        const response = await groq.chat.completions.create({
            model: "llama3-70b-8192",
            messages: [
                { role: "system", content: "Tu es une IA utile, claire et intelligente." },
                { role: "user", content: question }
            ],
            temperature: 0.7,
        });

        return response.choices[0].message.content;
    } catch (err) {
        console.error("Erreur IA :", err);
        return "❌ Erreur avec l'IA Groq.";
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.clear();
            console.log("📌 SCANNE CE QR CODE AVEC TON TÉLÉPHONE :\n");
            qrcode.generate(qr, { small: false });
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnexion…");
                startBot();
            } else {
                console.log("❌ Déconnecté. Supprime le dossier auth et relance.");
            }
        }

        if (connection === "open") {
            console.log("✅ Bot connecté !");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // Réponses IA
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        if (text.length > 0) {
            const reply = await askGroq(text);
            await sock.sendMessage(from, { text: reply });
        }
    });
}

startBot();
