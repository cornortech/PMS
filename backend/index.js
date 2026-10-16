// =====================================================================
// 💊 ARGYA HEALTH — Pharmacy Management System (backend)
// Express 5 + MongoDB. Every /api route (except login) needs a login token,
// and every pharmacy can only see and change ITS OWN data.
// =====================================================================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const connectDb = require("./connectDb");
const { requireAuth } = require("./utils/auth");

const app = express();
const PORT = process.env.PORT || 5000;

// Blocks NoSQL-injection such as {"id": {"$ne": null}} in database filters
mongoose.set("sanitizeFilter", true);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());

// Only these websites may call the API from a browser.
// Render → Environment → ALLOWED_ORIGINS = https://your-site.vercel.app,https://www.yourdomain.com
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://pharmacy-management-system-ramitnpns-projects.vercel.app,https://pms-seven-jet.vercel.app/")
    .split(",").map((o) => o.trim()).filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false); // not allowed → the browser blocks it
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
}));

// 🖐️ Fingerprint machines send their scans here (no login — checked by registered serial number)
app.use("/iclock", require("./routes/iclock"));

app.use(express.json({ limit: "200kb" }));

// A general limit so nobody can flood the server (300 requests per minute per IP)
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

// ---------- Public ----------
app.get("/", (req, res) => res.json({ status: "ok", service: "Argya Health API" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const auth = require("./routes/auth");
app.use("/api", auth.router); // login routes check the token themselves where needed

// ---------- 🔒 Everything below needs a valid token ----------
app.use("/api", requireAuth);
app.use("/api", require("./routes/admin").router);
app.use("/api", require("./routes/medicines").router);
app.use("/api", require("./routes/sales").router);
app.use("/api", require("./routes/patients").router);
const { allowRoles, requireManager } = require("./utils/auth");
app.use("/api/qr", allowRoles("Manager", "Pharmacist", "Accounts & Billing Officer"), require("./routes/qr")); // 💳 payment QR
app.use("/api/attendance", requireManager, require("./routes/attendance")); // 🖐️ attendance (Manager only)

// Unknown API route
app.use("/api", (req, res) => res.status(404).json({ success: false, message: "Not found." }));

// Any crash inside a route → a clean message, never the internal error details
app.use((err, req, res, next) => {
    if (err?.type === "entity.parse.failed") return res.status(400).json({ success: false, message: "Invalid request." });
    if (err?.type === "entity.too.large") return res.status(413).json({ success: false, message: "Request is too large." });
    if (err?.name === "CastError" || err?.name === "ValidationError") {
        return res.status(400).json({ success: false, message: "Some data is not valid. Please check and try again." });
    }
    console.error("🔴 SERVER ERROR:", err);
    res.status(500).json({ success: false, message: "Something went wrong on the server. Please try again." });
});

// ---------- One-time clean-ups for old data (safe to run every start) ----------
async function upgradeOldData() {
    const Inventory = require("./models/inventoryAndPOs");
    try {
        // Old rule: one barcode for the WHOLE system (and empty barcodes clashed). Now: unique per pharmacy.
        const indexes = await Inventory.collection.indexes();
        if (indexes.some((i) => i.name === "skuBarcodeReference_1")) {
            await Inventory.collection.dropIndex("skuBarcodeReference_1");
            console.log("🔧 Removed old global barcode rule.");
        }
    } catch (e) {
        if (e.codeName !== "NamespaceNotFound") console.warn("⚠️ Index clean-up:", e.message);
    }
    try {
        await Inventory.updateMany({ skuBarcodeReference: "" }, { $unset: { skuBarcodeReference: 1 } });
        await Inventory.syncIndexes();
    } catch (e) {
        console.warn("⚠️ Medicine index:", e.message);
    }
}

// ---------- Start (ONE listen only, after the database is connected) ----------
connectDb()
    .then(async () => {
        await upgradeOldData();
        app.listen(Number(PORT), "0.0.0.0", () => console.log(`✅ Argya Health server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error("❌ Server could not start because the database connection failed:", err.message);
        process.exit(1);
    });
