import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import pino from "pino";
import { Boom } from "@hapi/boom";
import Database from "better-sqlite3";
import multer from "multer";
import { parse } from "csv-parse/sync";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    }
});

const PORT = 3000;
const logger = pino({ level: "silent" });

// Database setup
const db = new Database("marketing.db");
db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        tags TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        content TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        content TEXT
    );
    CREATE TABLE IF NOT EXISTS autoreplies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT UNIQUE,
        response TEXT,
        enabled INTEGER DEFAULT 1
    );
`);

// WhatsApp Connection State
let sock: any = null;
let qrCode: string | null = null;
let connectionStatus: "connecting" | "open" | "close" | "qr" = "close";

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
    });

    sock.ev.on("connection.update", (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCode = qr;
            connectionStatus = "qr";
            io.emit("whatsapp-status", { status: "qr", qr });
        }

        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus = "close";
            qrCode = null;
            io.emit("whatsapp-status", { status: "close" });
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === "open") {
            connectionStatus = "open";
            qrCode = null;
            const userPhone = sock?.user?.id ? sock.user.id.split(":")[0] : null;
            io.emit("whatsapp-status", { status: "open", userPhone });
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m: any) => {
        if (m.type !== "notify") return;
        for (const msg of m.messages) {
            if (!msg.key.fromMe && msg.message) {
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
                if (text) {
                    const reply = db.prepare("SELECT response FROM autoreplies WHERE keyword = ? AND enabled = 1").get(text.toLowerCase().trim());
                    if (reply) {
                        await sock.sendMessage(msg.key.remoteJid, { text: reply.response });
                    }
                }
            }
        }
    });
}

connectToWhatsApp();

// API Routes
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.get("/api/status", (req, res) => {
    const userPhone = sock?.user?.id ? sock.user.id.split(":")[0] : null;
    res.json({ status: connectionStatus, qr: qrCode, userPhone });
});

app.get("/api/contacts", (req, res) => {
    const contacts = db.prepare("SELECT * FROM contacts ORDER BY id DESC").all();
    res.json(contacts);
});

app.delete("/api/contacts/:id", (req, res) => {
    db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
    res.json({ success: true });
});

app.delete("/api/contacts", (req, res) => {
    db.prepare("DELETE FROM contacts").run();
    res.json({ success: true });
});

app.get("/api/history", (req, res) => {
    const history = db.prepare("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100").all();
    res.json(history);
});

app.delete("/api/history", (req, res) => {
    db.prepare("DELETE FROM messages").run();
    res.json({ success: true });
});

// Templates
app.get("/api/templates", (req, res) => {
    const templates = db.prepare("SELECT * FROM templates").all();
    res.json(templates);
});

app.post("/api/templates", (req, res) => {
    const { name, content } = req.body;
    const result = db.prepare("INSERT INTO templates (name, content) VALUES (?, ?)").run(name, content);
    res.json({ id: result.lastInsertRowid });
});

app.delete("/api/templates/:id", (req, res) => {
    db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
    res.json({ success: true });
});

// Auto-replies
app.get("/api/autoreplies", (req, res) => {
    const replies = db.prepare("SELECT * FROM autoreplies").all();
    res.json(replies);
});

app.post("/api/autoreplies", (req, res) => {
    const { keyword, response } = req.body;
    try {
        const result = db.prepare("INSERT INTO autoreplies (keyword, response) VALUES (?, ?)").run(keyword, response);
        res.json({ id: result.lastInsertRowid });
    } catch (e) {
        res.status(400).json({ error: "Keyword already exists" });
    }
});

app.delete("/api/autoreplies/:id", (req, res) => {
    db.prepare("DELETE FROM autoreplies WHERE id = ?").run(req.params.id);
    res.json({ success: true });
});

app.post("/api/contacts/import", upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        const fileContent = fs.readFileSync(req.file.path, "utf-8");
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
        });

        const insert = db.prepare("INSERT OR IGNORE INTO contacts (name, phone) VALUES (?, ?)");
        const batch = db.transaction((contacts) => {
            for (const contact of contacts) {
                // Basic phone cleaning
                const phone = contact.phone.replace(/\D/g, "");
                insert.run(contact.name, phone);
            }
        });

        batch(records);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, count: records.length });
    } catch (error) {
        res.status(500).json({ error: "Failed to parse CSV" });
    }
});

app.post("/api/send-bulk", async (req, res) => {
    const { message, contacts } = req.body;
    if (connectionStatus !== "open") return res.status(400).json({ error: "WhatsApp not connected" });

    res.json({ success: true, message: "Bulk sending started" });

    for (const contact of contacts) {
        try {
            // Replace placeholders
            const personalizedMessage = message.replace(/{name}/g, contact.name || "Customer");
            const jid = `${contact.phone}@s.whatsapp.net`;
            
            await sock.sendMessage(jid, { text: personalizedMessage });
            
            db.prepare("INSERT INTO messages (phone, content, status) VALUES (?, ?, ?)").run(
                contact.phone,
                personalizedMessage,
                "sent"
            );
            
            io.emit("send-progress", { phone: contact.phone, status: "sent" });
            
            // Random delay to prevent ban (2-5 seconds)
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        } catch (error) {
            console.error(`Failed to send to ${contact.phone}`, error);
            io.emit("send-progress", { phone: contact.phone, status: "failed" });
        }
    }
});

app.post("/api/logout", async (req, res) => {
    if (sock) {
        await sock.logout();
        fs.rmSync("auth_info_baileys", { recursive: true, force: true });
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Not connected" });
    }
});

// Vite middleware for development
async function setupVite() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.join(__dirname, "dist")));
        app.get("*", (req, res) => {
            res.sendFile(path.join(__dirname, "dist", "index.html"));
        });
    }
}

setupVite().then(() => {
    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
