// 🔐 Login tokens + "who is calling?" check for every protected API route.
const jwt = require("jsonwebtoken");
const PharmacyUser = require("../models/login");
const PharmacyStaff = require("../models/loginStaff");
const { isExpired, EXPIRED_MESSAGE } = require("./subscription");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET is missing or shorter than 32 characters. Set it in Render → Environment.");
}

// The token only says WHO you are. Name, role and active status are re-read from
// the database on every request, so a deactivated account loses access immediately.
function signToken({ kind, uid, sid }) {
    return jwt.sign({ kind, uid, sid }, JWT_SECRET, { expiresIn: "12h" });
}

const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

async function requireAuth(req, res, next) {
    try {
        const [scheme, token] = (req.headers.authorization || "").split(" ");
        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({ success: false, code: "NO_TOKEN", message: "Please log in first." });
        }

        let claims;
        try {
            claims = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ success: false, code: "BAD_TOKEN", message: "Session expired. Please log in again." });
        }

        const pharmacy = await PharmacyUser.findById(claims.uid)
            .select("id pharmacyName isActive isAdmin totalTime remainingTime lastTimeSync createdAt")
            .lean();
        if (!pharmacy || !pharmacy.isActive) {
            return res.status(401).json({ success: false, code: "BAD_TOKEN", message: "Account not found or deactivated." });
        }
        if (isExpired(pharmacy)) {
            return res.status(403).json({ success: false, code: "SUBSCRIPTION_EXPIRED", message: EXPIRED_MESSAGE });
        }

        let role = null;
        let staffLoginId = "";
        if (claims.kind === "staff") {
            const staff = await PharmacyStaff.findById(claims.sid).select("id role isActive pharmacyName").lean();
            if (!staff || staff.isActive === false || !sameName(staff.pharmacyName, pharmacy.pharmacyName)) {
                return res.status(401).json({ success: false, code: "STAFF_GONE", message: "Staff account not found or deactivated." });
            }
            role = staff.role;
            staffLoginId = staff.id;
        }

        req.auth = {
            kind: claims.kind,                 // "pharmacy" or "staff"
            uid: String(pharmacy._id),
            staffId: claims.sid || null,
            staffLoginId,
            role,
            isAdmin: pharmacy.isAdmin === true,
            pharmacyId: pharmacy.id,           // ✅ the ONLY place the pharmacy comes from
            pharmacyName: pharmacy.pharmacyName,
        };
        next();
    } catch (err) {
        next(err);
    }
}

const requireAdmin = (req, res, next) =>
    req.auth?.isAdmin ? next() : res.status(403).json({ success: false, message: "Admin access only." });

// Staff with one of these roles (the super admin can do everything)
const allowRoles = (...roles) => (req, res, next) =>
    req.auth?.isAdmin || (req.auth?.kind === "staff" && roles.includes(req.auth.role))
        ? next()
        : res.status(403).json({ success: false, message: "Your role is not allowed to do this." });

const requireManager = allowRoles("Manager");

module.exports = { signToken, requireAuth, requireAdmin, requireManager, allowRoles };
