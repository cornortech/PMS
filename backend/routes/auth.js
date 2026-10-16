// =====================================================================
// 🔐 LOGIN
//   POST /api/auth/login              pharmacy (or super admin) login
//   POST /api/auth/admin-otp/verify   super admin: check the 6-digit email code
//   POST /api/auth/admin-otp/resend   super admin: new code (only after the old one expired)
//   POST /api/auth/verify             "is my saved login still valid?"
//   POST /api/staff/login             staff sign in on a computer already logged in as the pharmacy
// =====================================================================
const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const PharmacyUser = require("../models/login");
const PharmacyStaff = require("../models/loginStaff");
const adminOtp = require("../utils/adminOtp");
const { hashPassword, verifyPassword, needsRehash } = require("../utils/password");
const { signToken, requireAuth } = require("../utils/auth");
const { isExpired, EXPIRED_MESSAGE, daysLeft } = require("../utils/subscription");
const { str, exactI, wrap } = require("../utils/helpers");

const router = express.Router();

// 10 FAILED attempts per IP per 15 minutes. Successful logins are not counted.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many login attempts. Please wait 15 minutes and try again." },
});

// What the browser may see about a pharmacy account (never the password)
const publicPharmacy = (p) => ({
    _id: p._id,
    id: p.id,
    pharmacyName: p.pharmacyName,
    phone: p.phone,
    email: p.email,
    location: p.location,
    PanOrVat: p.PanOrVat,
    isActive: p.isActive,
    isAdmin: p.isAdmin,
    totalTime: p.totalTime,
    remainingTime: Number.isFinite(daysLeft(p)) ? Math.max(0, daysLeft(p)) : p.remainingTime,
    createdAt: p.createdAt,
});

router.post("/auth/login", loginLimiter, wrap(async (req, res) => {
    const pharmacyName = str(req.body?.pharmacyName, 120);
    const id = str(req.body?.id, 80);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!pharmacyName || !id || !password) {
        return res.status(400).json({ success: false, message: "Pharmacy name, ID and password are required." });
    }

    // One vague message for every failure, so attackers can't learn which part was wrong
    const fail = () => res.status(401).json({ success: false, message: "Invalid pharmacy name, ID or password." });

    const pharmacy = await PharmacyUser.findOne({ id }).select("+password");
    if (!pharmacy) return fail();
    if (pharmacy.pharmacyName.trim().toLowerCase() !== pharmacyName.toLowerCase()) return fail();
    if (!(await verifyPassword(password, pharmacy.password))) return fail();

    if (!pharmacy.isActive) {
        return res.status(403).json({ success: false, message: "This account is deactivated. Please contact Argya Health." });
    }
    if (isExpired(pharmacy)) {
        return res.status(403).json({ success: false, code: "SUBSCRIPTION_EXPIRED", message: EXPIRED_MESSAGE });
    }
    // Old plain-text password → secure hash on the first successful login
    if (needsRehash(pharmacy.password)) {
        pharmacy.password = await hashPassword(password);
        await pharmacy.save();
    }

    // 🔐 Super admin: the password is not enough — a code is emailed first.
    // 🚨 Emergency switch: ADMIN_OTP_OFF=true on Render skips the code (only if email is broken).
    if (pharmacy.isAdmin && process.env.ADMIN_OTP_OFF === "true") {
        console.warn("⚠️ ADMIN LOGIN WITHOUT EMAIL CODE — ADMIN_OTP_OFF is true. Remove it as soon as email works again.");
    }
    if (pharmacy.isAdmin && process.env.ADMIN_OTP_OFF !== "true") {
        try {
            const otp = await adminOtp.startAdminOtp(pharmacy);
            return res.status(200).json({
                success: true,
                otpRequired: true,
                message: otp.reused
                    ? `A code was already sent to ${otp.sentTo} — use the latest email. It works for ${otp.expiresIn} more seconds.`
                    : `We sent a 6-digit code to ${otp.sentTo}. It expires in 1 minute.`,
                ...otp,
            });
        } catch (e) {
            return res.status(e.status || 500).json({ success: false, message: e.message || "Could not start admin login." });
        }
    }

    const token = signToken({ kind: "pharmacy", uid: String(pharmacy._id) });
    return res.json({ success: true, message: "Login successful!", token, user: publicPharmacy(pharmacy) });
}));

const validChallenge = (v) => typeof v === "string" && /^[a-f0-9]{48}$/.test(v);

router.post("/auth/admin-otp/verify", loginLimiter, wrap(async (req, res) => {
    const challengeId = req.body?.challengeId;
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!validChallenge(challengeId) || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, code: "OTP_BAD_INPUT", message: "Please enter the 6-digit code." });
    }

    // Count this try FIRST (in one step), so many fast guesses can't get around the limit
    const ch = await adminOtp.AdminOtp.findOneAndUpdate(
        { challengeId, attempts: mongoose.trusted({ $lt: adminOtp.MAX_ATTEMPTS }) },
        { $inc: { attempts: 1 } },
        { new: true }
    );
    if (!ch) {
        await adminOtp.AdminOtp.deleteOne({ challengeId });
        return res.status(401).json({ success: false, code: "OTP_RESTART", message: "This login is no longer valid. Please log in again." });
    }
    if (ch.expiresAt.getTime() <= Date.now()) {
        return res.status(400).json({ success: false, code: "OTP_EXPIRED", message: "This code has expired. Please send a new code." });
    }
    if (!adminOtp.sameHash(adminOtp.hashCode(challengeId, code), ch.codeHash)) {
        const left = adminOtp.MAX_ATTEMPTS - ch.attempts;
        if (left <= 0) {
            await adminOtp.AdminOtp.deleteOne({ challengeId });
            return res.status(401).json({ success: false, code: "OTP_RESTART", message: "Too many wrong codes. Please log in again." });
        }
        return res.status(400).json({ success: false, code: "OTP_WRONG", message: `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.` });
    }

    await adminOtp.AdminOtp.deleteOne({ challengeId }); // ✅ a code works only once
    const user = await PharmacyUser.findById(ch.userId);
    if (!user || !user.isAdmin || !user.isActive) {
        return res.status(401).json({ success: false, code: "OTP_RESTART", message: "Account not available. Please log in again." });
    }
    const token = signToken({ kind: "pharmacy", uid: String(user._id) });
    return res.json({ success: true, message: "Login successful!", token, user: publicPharmacy(user) });
}));

router.post("/auth/admin-otp/resend", loginLimiter, wrap(async (req, res) => {
    const challengeId = req.body?.challengeId;
    if (!validChallenge(challengeId)) {
        return res.status(400).json({ success: false, code: "OTP_RESTART", message: "Please log in again." });
    }
    const ch = await adminOtp.AdminOtp.findOne({ challengeId });
    if (!ch || Date.now() - ch.createdAt.getTime() > adminOtp.LOGIN_WINDOW_MS || ch.resends >= adminOtp.MAX_RESENDS) {
        if (ch) await adminOtp.AdminOtp.deleteOne({ challengeId });
        return res.status(401).json({ success: false, code: "OTP_RESTART", message: "This login is no longer valid. Please log in again." });
    }
    const waitMs = ch.expiresAt.getTime() - Date.now();
    if (waitMs > 0) {
        return res.status(429).json({ success: false, code: "OTP_WAIT", message: `Please wait ${Math.ceil(waitMs / 1000)} seconds before asking for a new code.` });
    }

    const code = adminOtp.newCode();
    ch.codeHash = adminOtp.hashCode(challengeId, code); // the old code stops working
    ch.expiresAt = new Date(Date.now() + adminOtp.CODE_TTL_MS);
    ch.attempts = 0;
    ch.resends += 1;
    await ch.save();

    try {
        await adminOtp.sendCodeEmail(code);
    } catch (e) {
        console.error("🔴 ADMIN OTP RESEND EMAIL:", e.message);
        ch.expiresAt = new Date(); // nothing was sent → allow trying again straight away
        await ch.save();
        return res.status(502).json({ success: false, message: "Could not send the email. Please try again." });
    }
    const sentTo = adminOtp.maskEmail(process.env.ADMIN_OTP_EMAIL);
    return res.json({ success: true, message: `New code sent to ${sentTo}.`, expiresIn: adminOtp.CODE_TTL_MS / 1000, sentTo });
}));

// Everything below needs a valid login token
router.post("/auth/verify", requireAuth, wrap(async (req, res) => {
    const pharmacy = await PharmacyUser.findById(req.auth.uid);
    if (!pharmacy) return res.status(401).json({ success: false, message: "Invalid token" });
    let staff = null;
    if (req.auth.kind === "staff") {
        const s = await PharmacyStaff.findById(req.auth.staffId).lean();
        if (s) staff = { id: s.id, staffName: s.staffName, role: s.role };
    }
    return res.json({ success: true, user: publicPharmacy(pharmacy), staff });
}));

router.post("/staff/login", requireAuth, loginLimiter, wrap(async (req, res) => {
    const id = str(req.body?.id, 80);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!id || !password) {
        return res.status(400).json({ success: false, message: "Staff ID and password are required." });
    }

    // Only staff of the pharmacy that is logged in on THIS computer can sign in here
    const staff = await PharmacyStaff.findOne({ id, pharmacyName: exactI(req.auth.pharmacyName) }).select("+password");
    if (!staff || !(await verifyPassword(password, staff.password))) {
        return res.status(401).json({ success: false, message: "Invalid staff ID or password." });
    }
    if (staff.isActive === false) {
        return res.status(403).json({ success: false, message: "Your account is deactivated. Please ask your manager." });
    }
    if (needsRehash(staff.password)) {
        staff.password = await hashPassword(password);
        await staff.save();
    }

    const token = signToken({ kind: "staff", uid: req.auth.uid, sid: String(staff._id) });
    return res.json({
        success: true,
        token,
        user: { id: staff.id, staffName: staff.staffName, role: staff.role, pharmacyName: req.auth.pharmacyName },
    });
}));

module.exports = { router, publicPharmacy };
