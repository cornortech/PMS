// =====================================================================
// 🛠️ SUPER ADMIN (pharmacy accounts + subscription days) and 👥 STAFF
// =====================================================================
const express = require("express");
const mongoose = require("mongoose");
const PharmacyUser = require("../models/login");
const PharmacyStaff = require("../models/loginStaff");
const Counter = require("../models/counter");
const { hashPassword, validateNewPassword } = require("../utils/password");
const { requireAdmin, requireManager } = require("../utils/auth");
const { daysLeft } = require("../utils/subscription");
const { str, num, exactI, escapeRx, isId, wrap } = require("../utils/helpers");
const { publicPharmacy } = require("./auth");

const router = express.Router();

const STAFF_ROLES = ["Manager", "Pharmacist", "Accounts & Billing Officer", "Inventory Manager", "Doctor", "Receptionist"];
const MAX_DAYS = 3650;
const cleanDays = (v) => Math.min(MAX_DAYS, Math.max(0, Math.round(num(v, 0))));

// Every collection that stores data for one pharmacy (used when an account ID changes)
const PHARMACY_MODELS = () => [
    require("../models/inventoryAndPOs"),
    require("../models/sale"),
    require("../models/bill"),
    require("../models/stockMovement"),
    require("../models/supplier"),
    require("../models/settings"),
    require("../models/user"),
    require("../models/emr"),
    require("../models/QrConfig"),
];

// 🔒 A login ID is "used" if any data is still saved under it — for example a pharmacy
// that was deleted (its bills and patient records are kept for the records).
// Such an ID is never given to another pharmacy, so it can never see that old data.
async function loginIdHasData(id) {
    for (const M of PHARMACY_MODELS()) {
        if (await M.exists({ pharmacyId: id })) return true;
    }
    return !!(await Counter.exists({ _id: mongoose.trusted({ $regex: `^${escapeRx(id)}:` }) }));
}
const ID_HAS_DATA = "This login ID still has saved records from an old (deleted) pharmacy. Choose a different login ID.";

const publicStaff = (s) => ({
    _id: s._id,
    id: s.id,
    staffName: s.staffName,
    role: s.role,
    pharmacyName: s.pharmacyName,
    isActive: s.isActive !== false,
    createdAt: s.createdAt,
});

// ---------- Pharmacy accounts (super admin) ----------
router.get("/admin/users", requireAdmin, wrap(async (req, res) => {
    const users = await PharmacyUser.find({}).sort({ createdAt: -1 }).lean();
    const staffCount = {};
    for (const s of await PharmacyStaff.find({}).select("pharmacyName").lean()) {
        const k = String(s.pharmacyName || "").toLowerCase();
        staffCount[k] = (staffCount[k] || 0) + 1;
    }
    res.json({
        success: true,
        data: users.map((u) => ({ ...publicPharmacy(u), staffCount: staffCount[String(u.pharmacyName).toLowerCase()] || 0 })),
    });
}));

router.post("/admin/users", requireAdmin, wrap(async (req, res) => {
    const b = req.body || {};
    const pharmacyName = str(b.pharmacyName, 120);
    const id = str(b.id, 80);
    const email = str(b.email, 120);
    if (!pharmacyName || !id) {
        return res.status(400).json({ success: false, message: "Pharmacy name and login ID are required." });
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email." });
    }
    const pwError = validateNewPassword(b.password);
    if (pwError) return res.status(400).json({ success: false, message: pwError });

    if (await PharmacyUser.exists({ id })) {
        return res.status(400).json({ success: false, message: "This login ID is already used. Choose another." });
    }
    if (await loginIdHasData(id)) {
        return res.status(400).json({ success: false, message: ID_HAS_DATA });
    }
    if (await PharmacyUser.exists({ pharmacyName: exactI(pharmacyName) })) {
        return res.status(400).json({ success: false, message: "A pharmacy with this name already exists." });
    }

    const days = b.planDays === undefined ? 30 : cleanDays(b.planDays);
    const created = await PharmacyUser.create({
        pharmacyName,
        id,
        password: await hashPassword(b.password),
        phone: str(b.phone, 30),
        email,
        location: str(b.location, 200),
        PanOrVat: str(b.PanOrVat, 30),
        isActive: true,
        totalTime: days,
        remainingTime: days,
        lastTimeSync: new Date(),
    });
    res.status(201).json({ success: true, message: "Pharmacy account created!", data: publicPharmacy(created) });
}));

// Update a pharmacy account: the super admin (any account) or that pharmacy's Manager (own account only)
router.put("/admin/users/:userId", wrap(async (req, res) => {
    const { userId } = req.params;
    if (!isId(userId)) return res.status(400).json({ success: false, message: "Invalid id." });

    const isManagerOfIt = req.auth.kind === "staff" && req.auth.role === "Manager" && userId === req.auth.uid;
    if (!req.auth.isAdmin && !isManagerOfIt) {
        return res.status(403).json({ success: false, message: "You can only edit your own pharmacy." });
    }

    const pharmacy = await PharmacyUser.findById(userId).select("+password");
    if (!pharmacy) return res.status(404).json({ success: false, message: "Account not found." });

    const b = req.body || {};
    const oldName = pharmacy.pharmacyName;
    const oldId = pharmacy.id;

    // Login ID (super admin only — changing it moves all the pharmacy's data to the new ID)
    if (req.auth.isAdmin && str(b.id, 80) && str(b.id, 80) !== pharmacy.id) {
        if (await PharmacyUser.exists({ id: str(b.id, 80) })) {
            return res.status(400).json({ success: false, message: "That login ID is already taken." });
        }
        if (await loginIdHasData(str(b.id, 80))) {
            return res.status(400).json({ success: false, message: ID_HAS_DATA });
        }
        pharmacy.id = str(b.id, 80);
    }

    const newName = str(b.pharmacyName, 120);
    if (newName && newName !== pharmacy.pharmacyName) {
        const clash = await PharmacyUser.exists({ pharmacyName: exactI(newName), _id: mongoose.trusted({ $ne: pharmacy._id }) });
        if (clash) return res.status(400).json({ success: false, message: "A pharmacy with this name already exists." });
        pharmacy.pharmacyName = newName;
    }

    if (b.phone !== undefined) pharmacy.phone = str(b.phone, 30);
    if (b.email !== undefined) {
        const email = str(b.email, 120);
        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email." });
        }
        pharmacy.email = email;
    }
    if (b.location !== undefined) pharmacy.location = str(b.location, 200);
    if (b.PanOrVat !== undefined) pharmacy.PanOrVat = str(b.PanOrVat, 30);

    // 📅 Subscription days (super admin only)
    //   • Days left (remaining) can be set to any number
    //   • Total days can only go UP (adding days), never down
    if (req.auth.isAdmin) {
        const left = Number.isFinite(daysLeft(pharmacy)) ? Math.max(0, daysLeft(pharmacy)) : 0;
        if (b.addDays !== undefined) {
            const add = Math.round(num(b.addDays, 0));
            if (add < 1 || add > MAX_DAYS) return res.status(400).json({ success: false, message: "You can only add days (1 to 3650). To lower the days left, edit “Days left”." });
            pharmacy.remainingTime = Math.min(MAX_DAYS, left + add);
            pharmacy.totalTime = Math.min(MAX_DAYS * 10, (pharmacy.totalTime || 0) + add);
            pharmacy.lastTimeSync = new Date();
        }
        if (b.totalTime !== undefined) {
            const total = cleanDays(b.totalTime);
            if (total < (pharmacy.totalTime || 0)) {
                return res.status(400).json({ success: false, message: `Total days can only be increased (now ${pharmacy.totalTime}).` });
            }
            pharmacy.totalTime = total;
        }
        if (b.remainingTime !== undefined) {
            pharmacy.remainingTime = cleanDays(b.remainingTime);
            if (pharmacy.remainingTime > (pharmacy.totalTime || 0)) pharmacy.totalTime = pharmacy.remainingTime; // total never below days left
            pharmacy.lastTimeSync = new Date(); // count down from now
        } else if (b.totalTime !== undefined && b.addDays === undefined) {
            pharmacy.remainingTime = left;
            pharmacy.lastTimeSync = new Date();
        }
        if (b.isActive !== undefined) {
            if (pharmacy.isAdmin && b.isActive !== true) {
                return res.status(400).json({ success: false, message: "The admin account cannot be deactivated." });
            }
            pharmacy.isActive = b.isActive === true;
        }
    }

    if (b.password) {
        const pwError = validateNewPassword(b.password);
        if (pwError) return res.status(400).json({ success: false, message: pwError });
        pharmacy.password = await hashPassword(b.password);
    }

    await pharmacy.save();

    // Keep staff logins working after a rename
    if (pharmacy.pharmacyName !== oldName) {
        await PharmacyStaff.updateMany({ pharmacyName: exactI(oldName) }, { $set: { pharmacyName: pharmacy.pharmacyName } });
    }
    // Move all data to the new login ID (bill numbers continue, they don't restart)
    if (pharmacy.id !== oldId) {
        await Promise.all(PHARMACY_MODELS().map((M) => M.updateMany({ pharmacyId: oldId }, { $set: { pharmacyId: pharmacy.id } })));
        const counters = await Counter.find({ _id: mongoose.trusted({ $regex: `^${escapeRx(oldId)}:` }) }).lean();
        for (const c of counters) {
            const newKey = pharmacy.id + c._id.slice(oldId.length);
            await Counter.updateOne({ _id: newKey }, { $max: { seq: c.seq } }, { upsert: true });
            await Counter.deleteOne({ _id: c._id });
        }
    }

    res.json({ success: true, message: "Updated successfully.", data: publicPharmacy(pharmacy) });
}));

router.delete("/admin/users/:id", requireAdmin, wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const target = await PharmacyUser.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: "Account not found." });
    if (target.isAdmin) return res.status(400).json({ success: false, message: "The admin account cannot be deleted." });
    await PharmacyStaff.deleteMany({ pharmacyName: exactI(target.pharmacyName) });
    await target.deleteOne();
    res.json({ success: true, message: "Pharmacy account deleted." });
}));

// ---------- Staff (that pharmacy's Manager, or the super admin) ----------
// A Manager may only touch staff of their own pharmacy
const findStaffInScope = async (req, mongoId) => {
    if (!isId(mongoId)) return null;
    const staff = await PharmacyStaff.findById(mongoId).select("+password");
    if (!staff) return null;
    if (!req.auth.isAdmin && staff.pharmacyName.trim().toLowerCase() !== req.auth.pharmacyName.trim().toLowerCase()) return null;
    return staff;
};

router.get("/admin/staff-by-pharmacy/:pharmacyName", requireManager, wrap(async (req, res) => {
    const name = req.auth.isAdmin ? str(req.params.pharmacyName, 120) : req.auth.pharmacyName;
    const staff = await PharmacyStaff.find({ pharmacyName: exactI(name) }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: staff.map(publicStaff) });
}));

router.get("/staff/roles", (req, res) => res.json({ success: true, data: STAFF_ROLES }));

router.post("/staff/create", requireManager, wrap(async (req, res) => {
    const b = req.body || {};
    let pharmacyName = req.auth.isAdmin ? str(b.pharmacyName, 120) : req.auth.pharmacyName;
    const id = str(b.id, 80);
    const staffName = str(b.staffName, 80);
    const role = str(b.role, 60);

    if (!pharmacyName || !id || !staffName) {
        return res.status(400).json({ success: false, message: "Staff name, ID and password are required." });
    }
    if (!STAFF_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: `Role must be one of: ${STAFF_ROLES.join(", ")}.` });
    }
    const pwError = validateNewPassword(b.password);
    if (pwError) return res.status(400).json({ success: false, message: pwError });

    const owner = await PharmacyUser.findOne({ pharmacyName: exactI(pharmacyName) }).lean();
    if (!owner) return res.status(404).json({ success: false, message: "Pharmacy not found." });
    pharmacyName = owner.pharmacyName;
    if (await PharmacyStaff.exists({ pharmacyName: exactI(pharmacyName), id })) {
        return res.status(400).json({ success: false, message: "A staff member with this ID already exists." });
    }

    const created = await PharmacyStaff.create({
        staffName,
        pharmacyName,
        id,
        role,
        password: await hashPassword(b.password),
        isActive: b.isActive !== false,
    });
    res.status(201).json({ success: true, message: "Staff created", data: publicStaff(created) });
}));

router.put("/staff/:id", requireManager, wrap(async (req, res) => {
    const staff = await findStaffInScope(req, req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });

    const b = req.body || {};
    const isSelf = String(staff._id) === req.auth.staffId;

    if (str(b.staffName, 80)) staff.staffName = str(b.staffName, 80);
    if (str(b.id, 80) && str(b.id, 80) !== staff.id) {
        if (await PharmacyStaff.exists({ pharmacyName: exactI(staff.pharmacyName), id: str(b.id, 80) })) {
            return res.status(400).json({ success: false, message: "That staff ID is already taken." });
        }
        staff.id = str(b.id, 80);
    }
    if (b.role !== undefined) {
        if (!STAFF_ROLES.includes(str(b.role, 60))) return res.status(400).json({ success: false, message: "Invalid role." });
        if (isSelf && str(b.role, 60) !== staff.role) {
            return res.status(400).json({ success: false, message: "You cannot change your own role." });
        }
        staff.role = str(b.role, 60);
    }
    if (b.isActive !== undefined) {
        if (isSelf && b.isActive !== true) {
            return res.status(400).json({ success: false, message: "You cannot deactivate your own account." });
        }
        staff.isActive = b.isActive === true;
    }
    if (b.password) {
        const pwError = validateNewPassword(b.password);
        if (pwError) return res.status(400).json({ success: false, message: pwError });
        staff.password = await hashPassword(b.password);
    }
    await staff.save();
    res.json({ success: true, data: publicStaff(staff) });
}));

router.delete("/staff/:id", requireManager, wrap(async (req, res) => {
    const staff = await findStaffInScope(req, req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });
    if (String(staff._id) === req.auth.staffId) {
        return res.status(400).json({ success: false, message: "You cannot delete your own account." });
    }
    await staff.deleteOne();
    res.json({ success: true, message: "Staff member deleted." });
}));

// 📅 Days left for the logged-in pharmacy (shown at the top of the app)
router.get("/subscription", wrap(async (req, res) => {
    const p = await PharmacyUser.findById(req.auth.uid).lean();
    const left = daysLeft(p);
    res.json({
        success: true,
        data: { totalTime: p.totalTime, remainingTime: Number.isFinite(left) ? Math.max(0, left) : null, isAdmin: p.isAdmin },
    });
}));

module.exports = { router, STAFF_ROLES };
