const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const axios = require("axios");

// --- SESSION CLEAN ---
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_new");

    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnexion…");
                startBot();
            } else {
                console.log("❌ Déconnecté définitivement.");
            }
        } else if (connection === "open") {
            console.log("✅ Connecté à WhatsApp !");
        }
    });

    // --- MESSAGE HANDLER ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        console.log("📩 Message reçu :", text);

        // --- GROQ AI ---
        try {
            const response = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model: "llama3-8b-8192",
                    messages: [
                        { role: "system", content: "Tu es un bot WhatsApp intelligent et amical." },
                        { role: "user", content: text }
                    ]
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                    }
                }
            );

            const reply = response.data.choices[0].message.content;

            await sock.sendMessage(msg.key.remoteJid, { text: reply });

        } catch (err) {
            console.error("Erreur GROQ :", err);
            await sock.sendMessage(msg.key.remoteJid, { text: "Erreur avec l'IA." });
        }
    });
}

startBot();
