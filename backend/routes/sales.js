// =====================================================================
// 🧾 SALES (bills), ⏳ PENDING (udharo / due), ❌ CANCEL, 📊 DASHBOARD, ⚙️ SETTINGS
// Prices, VAT and stock are worked out on the SERVER — the browser only says
// which medicines and how many, so nobody can change a price from the browser.
// =====================================================================
const express = require("express");
const mongoose = require("mongoose");
const Inventory = require("../models/inventoryAndPOs");
const Sale = require("../models/sale");
const LegacyBill = require("../models/bill");
const StockMovement = require("../models/stockMovement");
const Settings = require("../models/settings");
const Patient = require("../models/user");
const { allowRoles } = require("../utils/auth");
const { nextBillNumber, nextCreditNoteNumber } = require("../utils/billNumber");
const { toBS } = require("../utils/nepaliDate");
const { str, num, money, isId, phoneDigits, cleanPhone, nepalDayKey, nepalDayStart, wrap } = require("../utils/helpers");

const router = express.Router();
const M = "Manager", P = "Pharmacist", B = "Accounts & Billing Officer", I = "Inventory Manager", D = "Doctor", R = "Receptionist";

const PAID_METHODS = ["Cash", "eSewa", "Khalti", "Fonepay", "Bank", "Card"];
const DUE = "Due";
const MAX_LINES = 100;
const MAX_QTY = 100000;

// ---------- Settings ----------
const DEFAULT_SETTINGS = { vatEnabled: true, vatRate: 13, printSize: "80mm", billFooter: "Thank you! Get well soon.", expiryAlertDays: 90, allowDue: true };
async function getSettings(pharmacyId) {
    const s = await Settings.findOne({ pharmacyId }).lean();
    return { ...DEFAULT_SETTINGS, ...(s || {}) };
}
const publicSettings = (s) => ({
    vatEnabled: s.vatEnabled !== false,
    vatRate: s.vatRate,
    printSize: s.printSize,
    billFooter: s.billFooter,
    expiryAlertDays: s.expiryAlertDays,
    allowDue: s.allowDue !== false,
});

router.get("/settings", allowRoles(M, P, B, I, D, R), wrap(async (req, res) => {
    res.json({ success: true, data: publicSettings(await getSettings(req.auth.pharmacyId)) });
}));

router.put("/settings", allowRoles(M), wrap(async (req, res) => {
    const b = req.body || {};
    const set = {};
    if (b.vatEnabled !== undefined) set.vatEnabled = b.vatEnabled === true;
    if (b.vatRate !== undefined) {
        const r = num(b.vatRate, NaN);
        if (!Number.isFinite(r) || r < 0 || r > 100) return res.status(400).json({ success: false, message: "VAT rate must be between 0 and 100." });
        set.vatRate = money(r);
    }
    if (b.printSize !== undefined) {
        if (!["58mm", "80mm", "A4"].includes(b.printSize)) return res.status(400).json({ success: false, message: "Invalid bill size." });
        set.printSize = b.printSize;
    }
    if (b.billFooter !== undefined) set.billFooter = str(b.billFooter, 200);
    if (b.expiryAlertDays !== undefined) {
        const d = Math.round(num(b.expiryAlertDays, NaN));
        if (!Number.isFinite(d) || d < 1 || d > 730) return res.status(400).json({ success: false, message: "Expiry alert must be 1–730 days." });
        set.expiryAlertDays = d;
    }
    if (b.allowDue !== undefined) set.allowDue = b.allowDue === true;
    const s = await Settings.findOneAndUpdate(
        { pharmacyId: req.auth.pharmacyId },
        { $set: set, $setOnInsert: { pharmacyId: req.auth.pharmacyId } },
        { new: true, upsert: true }
    ).lean();
    res.json({ success: true, message: "Settings saved.", data: publicSettings({ ...DEFAULT_SETTINGS, ...s }) });
}));

// ---------- Helpers ----------
const toSale = (s) => ({
    id: String(s._id),
    invoiceNo: s.invoiceNo,
    dateBS: s.dateBS || "",
    customerName: s.customerName,
    customerPhone: s.customerPhone || "",
    patientId: s.patientId || "",
    items: s.items || [],
    subTotal: s.subTotal,
    discount: s.discount,
    taxableAmount: s.taxableAmount,
    vatRate: s.vatRate,
    vatAmount: s.vatAmount,
    grandTotal: s.grandTotal,
    profit: s.profit || 0,
    paymentMethod: s.paymentMethod,
    status: s.status,
    paidAt: s.paidAt,
    note: s.note || "",
    soldBy: s.soldBy || "",
    cancelReason: s.cancelReason || "",
    cancelledAt: s.cancelledAt,
    creditNoteNo: s.creditNoteNo || "",
    createdAt: s.createdAt,
    legacy: false,
});

// Old bills (saved before this update: one row per medicine) → shown as normal paid bills, read-only
async function legacySales(pharmacyId, from, to) {
    const filter = { pharmacyId };
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = from;
        if (to) filter.createdAt.$lt = to;
        filter.createdAt = mongoose.trusted(filter.createdAt);
    }
    const rows = await LegacyBill.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    const byInvoice = new Map();
    for (const r of rows) {
        const key = r.invoiceNo || String(r._id);
        if (!byInvoice.has(key)) {
            const created = r.date || r.createdAt;
            byInvoice.set(key, {
                id: `legacy-${r._id}`,
                invoiceNo: key,
                dateBS: "",
                customerName: r.billTo || "Walk-in Customer",
                customerPhone: "",
                patientId: "",
                items: [],
                subTotal: money(r.subtotal),
                discount: money(Math.max(0, (r.subtotal || 0) - (r.taxablePostsubdiscountSubtotal || r.subtotal || 0))),
                taxableAmount: money(r.taxablePostsubdiscountSubtotal || r.subtotal),
                vatRate: r.taxablePostsubdiscountSubtotal ? money(((r.vATCollected || 0) / r.taxablePostsubdiscountSubtotal) * 100) : 0,
                vatAmount: money(r.vATCollected),
                grandTotal: money(r.grandTotal),
                profit: 0,
                paymentMethod: r.paymentMethod || "Cash",
                status: "paid",
                paidAt: created,
                note: "",
                soldBy: "",
                cancelReason: "",
                cancelledAt: null,
                creditNoteNo: "",
                createdAt: created,
                legacy: true,
            });
        }
        byInvoice.get(key).items.push({
            medicineId: "",
            name: r.item || "Item",
            dosage: "",
            quantity: r.qty || 1,
            unitPrice: money(r.rate),
            total: money(r.total),
        });
    }
    return [...byInvoice.values()];
}

// ---------- Create a bill ----------
router.post("/sales", allowRoles(M, P, B), wrap(async (req, res) => {
    const pharmacyId = req.auth.pharmacyId;
    const b = req.body || {};

    // Same bill sent twice (double click / slow internet) → return the first one, don't sell twice
    const clientRequestId = typeof b.clientRequestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.clientRequestId) ? b.clientRequestId : undefined;
    if (clientRequestId) {
        const existing = await Sale.findOne({ pharmacyId, clientRequestId }).lean();
        if (existing) return res.status(200).json({ success: true, duplicate: true, message: "Bill already saved.", data: toSale(existing) });
    }

    // Lines: merge the same medicine, check quantities
    if (!Array.isArray(b.items) || b.items.length === 0) {
        return res.status(400).json({ success: false, message: "Add at least one medicine to the bill." });
    }
    if (b.items.length > MAX_LINES) return res.status(400).json({ success: false, message: `A bill can have at most ${MAX_LINES} lines.` });
    const wanted = new Map();
    for (const line of b.items) {
        const id = line?.medicineId;
        const qty = Math.round(num(line?.quantity, 0));
        if (!isId(id) || qty < 1 || qty > MAX_QTY) return res.status(400).json({ success: false, message: "Every line needs a medicine and a quantity of 1 or more." });
        wanted.set(String(id), (wanted.get(String(id)) || 0) + qty);
    }

    const paymentMethod = str(b.paymentMethod, 20);
    if (![...PAID_METHODS, DUE].includes(paymentMethod)) {
        return res.status(400).json({ success: false, message: "Please choose how the customer paid." });
    }
    const settings = await getSettings(pharmacyId);
    const customerName = str(b.customerName, 80) || "Walk-in Customer";
    const customerPhone = cleanPhone(b.customerPhone);
    if (paymentMethod === DUE) {
        if (!settings.allowDue) return res.status(400).json({ success: false, message: "Due (pending) bills are turned off in Settings." });
        if (customerName === "Walk-in Customer" && phoneDigits(customerPhone).length < 7) {
            return res.status(400).json({ success: false, message: "For a Due (pending) bill, enter the customer's name or phone so you know who owes the money." });
        }
    }

    let patientId = "";
    if (b.patientId) {
        if (!isId(b.patientId) || !(await Patient.exists({ _id: b.patientId, pharmacyId }))) {
            return res.status(400).json({ success: false, message: "Patient not found." });
        }
        patientId = String(b.patientId);
    }

    const meds = await Inventory.find({ _id: mongoose.trusted({ $in: [...wanted.keys()] }), pharmacyId }).lean();
    const medById = new Map(meds.map((m) => [String(m._id), m]));
    const today = nepalDayStart(nepalDayKey());
    for (const [id, qty] of wanted) {
        const m = medById.get(id);
        if (!m) return res.status(400).json({ success: false, message: "A medicine in the bill was not found. Refresh and try again." });
        if (m.expirationDate && new Date(m.expirationDate) < today) {
            return res.status(400).json({ success: false, message: `${m.medicineBrandName} is EXPIRED. Expired medicine cannot be sold.` });
        }
        if ((m.initialStockQty || 0) < qty) {
            return res.status(409).json({ success: false, message: `Only ${m.initialStockQty || 0} ${m.medicineBrandName} left in stock.` });
        }
    }

    // Take the stock (only if enough is still there — two counters can't sell the last box twice)
    const taken = [];
    const undo = async () => {
        for (const t of taken) await Inventory.updateOne({ _id: t.id }, { $inc: { initialStockQty: t.qty } });
    };
    const after = new Map();
    for (const [id, qty] of wanted) {
        const updated = await Inventory.findOneAndUpdate(
            { _id: id, pharmacyId, initialStockQty: mongoose.trusted({ $gte: qty }) },
            { $inc: { initialStockQty: -qty } },
            { new: true }
        ).lean();
        if (!updated) {
            await undo();
            return res.status(409).json({ success: false, message: `${medById.get(id).medicineBrandName} just ran out of stock. Please check the quantity.` });
        }
        taken.push({ id, qty });
        after.set(id, updated.initialStockQty);
    }

    try {
        // Money (all on the server)
        const items = [...wanted].map(([id, qty]) => {
            const m = medById.get(id);
            return {
                medicineId: id,
                name: m.medicineBrandName,
                genericName: m.genericMoleculeName || "",
                dosage: m.dosageStrength || "",
                batchNo: m.batchNo || "",
                expiryDate: m.expirationDate || null,
                quantity: qty,
                unitPrice: money(m.retailPrice),
                costPrice: money(m.purchaseUnitCost),
                total: money(qty * (m.retailPrice || 0)),
            };
        });
        const subTotal = money(items.reduce((s, i) => s + i.total, 0));
        let discount = 0;
        if (b.discountPercent !== undefined && b.discountPercent !== "") {
            const pct = Math.min(100, Math.max(0, num(b.discountPercent, 0)));
            discount = money((subTotal * pct) / 100);
        } else {
            discount = money(Math.min(subTotal, Math.max(0, num(b.discount, 0))));
        }
        const taxableAmount = money(subTotal - discount);
        const vatRate = settings.vatEnabled ? settings.vatRate : 0;
        const vatAmount = money((taxableAmount * vatRate) / 100);
        const grandTotal = money(taxableAmount + vatAmount);
        const cost = items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
        const profit = money(taxableAmount - cost);

        const now = new Date();
        const { fiscalYear, invoiceNo } = await nextBillNumber(pharmacyId, now);
        const isDue = paymentMethod === DUE;
        const sale = await Sale.create({
            pharmacyId,
            invoiceNo,
            fiscalYear,
            dateBS: toBS(now),
            customerName,
            customerPhone,
            patientId,
            items,
            subTotal,
            discount,
            taxableAmount,
            vatRate,
            vatAmount,
            grandTotal,
            profit,
            paymentMethod,
            status: isDue ? "pending" : "paid",
            paidAt: isDue ? null : now,
            note: str(b.note, 300),
            soldBy: req.auth.staffLoginId,
            clientRequestId,
        });

        await StockMovement.insertMany(items.map((i) => ({
            pharmacyId, medicineId: i.medicineId, medicineName: i.name, type: "Sale",
            change: -i.quantity, stockAfter: after.get(i.medicineId), note: `Bill ${invoiceNo}`, by: req.auth.staffLoginId,
        })));

        res.status(201).json({ success: true, message: isDue ? "Bill saved as Due (pending)." : "Sale completed.", data: toSale(sale) });
    } catch (err) {
        await undo(); // never lose stock if the bill could not be saved
        if (err?.code === 11000 && clientRequestId) {
            const existing = await Sale.findOne({ pharmacyId, clientRequestId }).lean();
            if (existing) return res.status(200).json({ success: true, duplicate: true, data: toSale(existing) });
        }
        throw err;
    }
}));

// ---------- List bills ----------
// ?from=2026-10-01&to=2026-10-15 (Nepal days, both included) &status=paid|pending|cancelled &legacy=1
router.get("/sales", allowRoles(M, P, B), wrap(async (req, res) => {
    const pharmacyId = req.auth.pharmacyId;
    const filter = { pharmacyId };
    const dayRx = /^\d{4}-\d{2}-\d{2}$/;
    let from = null, to = null;
    if (dayRx.test(String(req.query.from || ""))) from = nepalDayStart(req.query.from);
    if (dayRx.test(String(req.query.to || ""))) to = new Date(nepalDayStart(req.query.to).getTime() + 86400000);
    if (from || to) {
        const range = {};
        if (from) range.$gte = from;
        if (to) range.$lt = to;
        filter.createdAt = mongoose.trusted(range);
    }
    const status = String(req.query.status || "");
    if (["paid", "pending", "cancelled"].includes(status)) filter.status = status;

    const rows = await Sale.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    let data = rows.map(toSale);
    if (req.query.legacy === "1" && (!status || status === "paid")) {
        data = data.concat(await legacySales(pharmacyId, from, to)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    res.json({ success: true, count: data.length, data });
}));

// ---------- Receive money for a pending (due) bill ----------
router.patch("/sales/:id/settle", allowRoles(M, P, B), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const method = str(req.body?.paymentMethod, 20);
    if (!PAID_METHODS.includes(method)) return res.status(400).json({ success: false, message: "Please choose how the customer paid." });
    const sale = await Sale.findOneAndUpdate(
        { _id: req.params.id, pharmacyId: req.auth.pharmacyId, status: "pending" },
        { $set: { status: "paid", paymentMethod: method, paidAt: new Date() } },
        { new: true }
    ).lean();
    if (!sale) return res.status(404).json({ success: false, message: "Pending bill not found (maybe already paid)." });
    res.json({ success: true, message: `Payment received via ${method}.`, data: toSale(sale) });
}));

// ---------- Cancel a bill (Manager): stock goes back, a credit note number is given ----------
// Bills are never deleted (IRD rule) — they are marked cancelled with a reason.
router.post("/sales/:id/cancel", allowRoles(M), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const reason = str(req.body?.reason, 200);
    if (reason.length < 3) return res.status(400).json({ success: false, message: "Please write why this bill is cancelled." });

    const sale = await Sale.findOneAndUpdate(
        { _id: req.params.id, pharmacyId: req.auth.pharmacyId, status: mongoose.trusted({ $ne: "cancelled" }) },
        { $set: { status: "cancelled", cancelReason: reason, cancelledAt: new Date(), cancelledBy: req.auth.staffLoginId } },
        { new: true }
    );
    if (!sale) return res.status(404).json({ success: false, message: "Bill not found or already cancelled." });

    sale.creditNoteNo = await nextCreditNoteNumber(req.auth.pharmacyId);
    await sale.save();

    const moves = [];
    for (const i of sale.items) {
        const med = await Inventory.findOneAndUpdate(
            { _id: i.medicineId, pharmacyId: req.auth.pharmacyId },
            { $inc: { initialStockQty: i.quantity } },
            { new: true }
        ).lean();
        if (med) {
            moves.push({
                pharmacyId: req.auth.pharmacyId, medicineId: i.medicineId, medicineName: i.name, type: "Bill cancelled",
                change: i.quantity, stockAfter: med.initialStockQty, note: `Bill ${sale.invoiceNo} cancelled: ${reason}`, by: req.auth.staffLoginId,
            });
        }
    }
    if (moves.length) await StockMovement.insertMany(moves);
    res.json({ success: true, message: `Bill cancelled. Credit note ${sale.creditNoteNo}. Stock returned.`, data: toSale(sale.toObject()) });
}));

// ---------- Find a customer by phone (fills the name in New Sale) ----------
router.get("/customers/lookup", allowRoles(M, P, B), wrap(async (req, res) => {
    const digits = phoneDigits(req.query.phone);
    if (digits.length < 7) return res.json({ success: true, data: null });
    const rx = mongoose.trusted({ $regex: `${digits.split("").join("\\D*")}$` });
    const patient = await Patient.findOne({ pharmacyId: req.auth.pharmacyId, phoneNumber: rx }).sort({ updatedAt: -1 }).lean();
    const pendingCount = await Sale.countDocuments({ pharmacyId: req.auth.pharmacyId, customerPhone: rx, status: "pending" });
    if (patient) {
        return res.json({
            success: true,
            data: {
                name: patient.name, phone: patient.phoneNumber, patientId: String(patient._id),
                allergies: patient.drugSensitivities && patient.drugSensitivities !== "None" ? patient.drugSensitivities : "",
                pendingCount,
            },
        });
    }
    const last = await Sale.findOne({ pharmacyId: req.auth.pharmacyId, customerPhone: rx }).sort({ createdAt: -1 }).lean();
    if (!last) return res.json({ success: true, data: null });
    res.json({ success: true, data: { name: last.customerName, phone: last.customerPhone, patientId: last.patientId || "", allergies: "", pendingCount } });
}));

// ---------- 📊 Dashboard ----------
router.get("/dashboard/summary", allowRoles(M), wrap(async (req, res) => {
    const pharmacyId = req.auth.pharmacyId;
    const settings = await getSettings(pharmacyId);
    const todayKey = nepalDayKey();
    const todayStart = nepalDayStart(todayKey);
    const since = new Date(todayStart.getTime() - 29 * 86400000); // last 30 days (with today)

    const recent = (await Sale.find({ pharmacyId, createdAt: mongoose.trusted({ $gte: since }) }).lean()).map(toSale);
    const legacy = await legacySales(pharmacyId, since, null);
    const all = recent.concat(legacy);
    const live = all.filter((s) => s.status !== "cancelled");

    // Revenue = money RECEIVED (paid bills, on the day they were paid)
    const paidOnDay = (key) => live.filter((s) => s.status === "paid" && nepalDayKey(s.paidAt || s.createdAt) === key);
    const sum = (arr, f) => money(arr.reduce((t, x) => t + (Number(f(x)) || 0), 0));

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const key = nepalDayKey(new Date(todayStart.getTime() - i * 86400000 + 3600000));
        const billed = live.filter((s) => nepalDayKey(s.createdAt) === key);
        days.push({ day: key, revenue: sum(paidOnDay(key), (s) => s.grandTotal), bills: billed.length });
    }

    const todays = live.filter((s) => nepalDayKey(s.createdAt) === todayKey);
    const paidToday = paidOnDay(todayKey);
    const pendingAll = await Sale.find({ pharmacyId, status: "pending" }).select("grandTotal customerName customerPhone createdAt").lean();

    const topMap = new Map();
    for (const s of live) for (const i of s.items) {
        const k = i.name;
        const cur = topMap.get(k) || { name: k, quantity: 0, amount: 0 };
        cur.quantity += i.quantity;
        cur.amount = money(cur.amount + i.total);
        topMap.set(k, cur);
    }
    const payMap = {};
    for (const s of live.filter((x) => x.status === "paid")) payMap[s.paymentMethod] = money((payMap[s.paymentMethod] || 0) + s.grandTotal);

    const meds = await Inventory.find({ pharmacyId }).lean();
    const alertUntil = new Date(todayStart.getTime() + settings.expiryAlertDays * 86400000);
    const lowStock = meds.filter((m) => (m.initialStockQty || 0) <= (m.reorderThresholdAlert || 0));
    const expired = meds.filter((m) => m.expirationDate && new Date(m.expirationDate) < todayStart && (m.initialStockQty || 0) > 0);
    const expiring = meds.filter((m) => m.expirationDate && new Date(m.expirationDate) >= todayStart && new Date(m.expirationDate) <= alertUntil && (m.initialStockQty || 0) > 0);
    const brief = (m) => ({
        id: String(m._id), name: m.medicineBrandName, stock: m.initialStockQty || 0, reorderLevel: m.reorderThresholdAlert || 0,
        expiryDate: m.expirationDate ? new Date(m.expirationDate).toISOString().slice(0, 10) : "",
    });

    res.json({
        success: true,
        data: {
            today: {
                revenue: sum(paidToday, (s) => s.grandTotal),
                billed: sum(todays, (s) => s.grandTotal),
                bills: todays.length,
                profit: sum(todays, (s) => s.profit),
                due: sum(todays.filter((s) => s.status === "pending"), (s) => s.grandTotal),
            },
            last30: {
                revenue: sum(live.filter((s) => s.status === "paid"), (s) => s.grandTotal),
                profit: sum(live, (s) => s.profit),
                bills: live.length,
                cancelled: all.filter((s) => s.status === "cancelled").length,
            },
            pending: { amount: sum(pendingAll, (s) => s.grandTotal), count: pendingAll.length },
            days,
            topMedicines: [...topMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6),
            payments: payMap,
            stock: {
                medicines: meds.length,
                costValue: sum(meds, (m) => (m.purchaseUnitCost || 0) * (m.initialStockQty || 0)),
                retailValue: sum(meds, (m) => (m.retailPrice || 0) * (m.initialStockQty || 0)),
                lowStock: lowStock.sort((a, b) => (a.initialStockQty || 0) - (b.initialStockQty || 0)).slice(0, 8).map(brief),
                lowStockCount: lowStock.length,
                outOfStockCount: meds.filter((m) => (m.initialStockQty || 0) <= 0).length,
                expired: expired.slice(0, 8).map(brief),
                expiredCount: expired.length,
                expiring: expiring.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate)).slice(0, 8).map(brief),
                expiringCount: expiring.length,
                expiryAlertDays: settings.expiryAlertDays,
            },
            recentSales: all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6),
        },
    });
}));

module.exports = { router, PAID_METHODS };
