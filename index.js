const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

// Normalisation du texte
function normalize(str) {
    if (!str) return "";
    str = str.toLowerCase();
    const map = {
        "à":"a","á":"a","â":"a","ä":"a","ã":"a","å":"a",
        "ç":"c",
        "è":"e","é":"e","ê":"e","ë":"e",
        "ì":"i","í":"i","î":"i","ï":"i",
        "ñ":"n",
        "ò":"o","ó":"o","ô":"o","ö":"o","õ":"o",
        "ù":"u","ú":"u","û":"u","ü":"u",
        "ý":"y","ÿ":"y"
    };
    return str.replace(/[^\u0000-\u007E]/g, c => map[c] || c).trim();
}

// Extraction du texte
function extractText(msg) {
    try {
        if (msg.message.conversation) return msg.message.conversation;
        if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
        if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
        if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
        if (msg.message.buttonsResponseMessage?.selectedButtonId) return msg.message.buttonsResponseMessage.selectedButtonId;
        if (msg.message.listResponseMessage?.singleSelectReply?.selectedRowId) return msg.message.listResponseMessage.singleSelectReply.selectedRowId;

        if (msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text)
            return msg.message.ephemeralMessage.message.extendedTextMessage.text;

        if (msg.message?.ephemeralMessage?.message?.conversation)
            return msg.message.ephemeralMessage.message.conversation;

        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation)
            return msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation;

        return "";
    } catch {
        return "";
    }
}

// IA améliorée
function generateAIResponse(raw) {
    const original = raw || "";
    const t = normalize(original);

    // Calcul automatique
    const calc = t.replace(/[^0-9+\-*/().]/g, "");
    if (calc.match(/[0-9]/) && calc.match(/[\+\-\*\/]/)) {
        try {
            const result = eval(calc);
            if (!isNaN(result)) return `Le résultat est : ${result}`;
        } catch {}
    }

    // Questions générales
    if (original.includes("?")) {
        return "Bonne question. Je ne suis pas connecté à internet, mais je peux t’aider à réfléchir. Reformule un peu si tu veux une réponse plus précise.";
    }

    // Réponses intelligentes
    return "Je vois. Si tu veux une réponse plus précise, explique un peu plus.";
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;

    if (qr) qrcode.generate(qr, { small: true });
    if (connection === "open") console.log("Bot connecté ✔️");
    if (connection === "close") startBot();
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    const sender = msg.key.participant || msg.key.remoteJid;

    let text = extractText(msg).trim();
    const norm = normalize(text);

    const mustMention =
      norm.includes("phenix") ||
      norm.includes("@phenix");

    // 🔥 TON NUMÉRO (correct)
    const yourNumber = "33665381003@c.us";

    // 🔥 MP → répond UNIQUEMENT si c’est TOI ou si @phenix est écrit
    if (!isGroup) {
        if (sender === yourNumber || mustMention) {
            const answer = generateAIResponse(text);
            return sock.sendMessage(from, { text: answer });
        }
        return; // ignore les autres MP
    }

    // 🔥 Groupe → répond UNIQUEMENT si @phenix
    if (mustMention) {
        const answer = generateAIResponse(text);
        return sock.sendMessage(from, { text: answer });
    }
  });
}

startBot();
