// Small shared helpers
const mongoose = require("mongoose");

// Only accept real strings from the browser (blocks {"$ne": null} style tricks), trimmed + max length
const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Case-insensitive exact match that works on every MongoDB host
const exactI = (s) => mongoose.trusted({ $regex: `^${escapeRx(s)}$`, $options: "i" });
const phoneDigits = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const cleanPhone = (v) => str(v, 20).replace(/[^0-9+\-\s]/g, "");
const isId = (v) => mongoose.isValidObjectId(v);

// Nepal calendar day ("2026-10-15") for any moment (Nepal = UTC+5:45)
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
const nepalDayKey = (d = new Date()) => new Date(new Date(d).getTime() + NEPAL_OFFSET_MS).toISOString().slice(0, 10);
// The UTC moment when a Nepal day ("2026-10-15") starts
const nepalDayStart = (key) => new Date(new Date(`${key}T00:00:00Z`).getTime() - NEPAL_OFFSET_MS);

// Wrap async route handlers so errors go to the error handler (no crash)
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { str, num, money, escapeRx, exactI, phoneDigits, cleanPhone, isId, nepalDayKey, nepalDayStart, wrap };
