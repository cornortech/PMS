// =====================================================================
// 💊 MEDICINES (stock), 📦 STOCK HISTORY and 🚚 SUPPLIERS
// The pharmacy ALWAYS comes from the login token, never from the browser.
// =====================================================================
const express = require("express");
const Inventory = require("../models/inventoryAndPOs");
const StockMovement = require("../models/stockMovement");
const Supplier = require("../models/supplier");
const { allowRoles } = require("../utils/auth");
const { str, num, money, isId, wrap } = require("../utils/helpers");

const router = express.Router();

const M = "Manager", P = "Pharmacist", B = "Accounts & Billing Officer", I = "Inventory Manager", D = "Doctor", R = "Receptionist";
const CATEGORIES = ["Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Drops", "Inhaler", "Powder", "Device", "Cosmetic", "Other"];
const MAX_QTY = 1000000;

const toMedicine = (m) => ({
    id: String(m._id),
    _id: String(m._id),
    name: m.medicineBrandName,
    genericName: m.genericMoleculeName || "",
    category: m.categoryType || "Other",
    dosage: m.dosageStrength || "",
    costPrice: money(m.purchaseUnitCost),
    unitPrice: money(m.retailPrice),
    stock: Math.max(0, Number(m.initialStockQty) || 0),
    reorderLevel: Number(m.reorderThresholdAlert) || 0,
    sku: m.skuBarcodeReference || "",
    expiryDate: m.expirationDate ? new Date(m.expirationDate).toISOString().slice(0, 10) : "",
    supplier: m.supplierDistributor || "",
    batchNo: m.batchNo || "",
    rackLocation: m.rackLocation || "",
    unit: m.unit || "pcs",
    updatedAt: m.updatedAt,
});

// Reads + checks the medicine form. Returns { data } or { error }
function readMedicine(b, partial = false) {
    const data = {};
    const name = str(b.name ?? b.medicineBrandName, 120);
    if (!partial || name) {
        if (!name) return { error: "Medicine name is required." };
        data.medicineBrandName = name;
    }
    if (b.genericName !== undefined || b.genericMoleculeName !== undefined) data.genericMoleculeName = str(b.genericName ?? b.genericMoleculeName, 120);
    if (b.category !== undefined || b.categoryType !== undefined) {
        const c = str(b.category ?? b.categoryType, 40);
        data.categoryType = CATEGORIES.includes(c) ? c : "Other";
    }
    if (b.dosage !== undefined || b.dosageStrength !== undefined) data.dosageStrength = str(b.dosage ?? b.dosageStrength, 60);
    for (const [key, field, max] of [
        ["costPrice", "purchaseUnitCost", 10000000],
        ["unitPrice", "retailPrice", 10000000],
        ["reorderLevel", "reorderThresholdAlert", MAX_QTY],
    ]) {
        const raw = b[key] ?? b[field];
        if (raw === undefined || raw === "") continue;
        const n = num(raw, NaN);
        if (!Number.isFinite(n) || n < 0 || n > max) return { error: `Please enter a valid ${key === "costPrice" ? "cost price" : key === "unitPrice" ? "selling price" : "reorder level"}.` };
        data[field] = key === "reorderLevel" ? Math.round(n) : money(n);
    }
    if (b.sku !== undefined || b.skuBarcodeReference !== undefined) data.skuBarcodeReference = str(b.sku ?? b.skuBarcodeReference, 60);
    if (b.expiryDate !== undefined || b.expirationDate !== undefined) {
        const raw = str(b.expiryDate ?? b.expirationDate, 30);
        if (raw) {
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return { error: "Please enter a valid expiry date." };
            data.expirationDate = d;
        } else data.expirationDate = null;
    }
    if (b.supplier !== undefined || b.supplierDistributor !== undefined) data.supplierDistributor = str(b.supplier ?? b.supplierDistributor, 120);
    if (b.batchNo !== undefined) data.batchNo = str(b.batchNo, 40);
    if (b.rackLocation !== undefined) data.rackLocation = str(b.rackLocation, 40);
    if (b.unit !== undefined) data.unit = str(b.unit, 20) || "pcs";
    return { data };
}

const dupMessage = (err) =>
    err?.code === 11000 ? "Another medicine in your pharmacy already uses this barcode / SKU." : null;

// ---------- Medicines ----------
router.get("/inventory", allowRoles(M, P, B, I, D, R), wrap(async (req, res) => {
    const items = await Inventory.find({ pharmacyId: req.auth.pharmacyId }).sort({ medicineBrandName: 1 }).limit(10000).lean();
    res.json({ success: true, count: items.length, data: items.map(toMedicine), categories: CATEGORIES });
}));

router.post("/inventory", allowRoles(M, P, I), wrap(async (req, res) => {
    const { data, error } = readMedicine(req.body || {});
    if (error) return res.status(400).json({ success: false, message: error });

    const stock = Math.round(num(req.body?.stock ?? req.body?.initialStockQty, 0));
    if (stock < 0 || stock > MAX_QTY) return res.status(400).json({ success: false, message: "Please enter a valid opening stock." });
    if (!data.skuBarcodeReference) delete data.skuBarcodeReference; // empty barcode is not saved (avoids clashes)

    try {
        const med = await Inventory.create({ ...data, initialStockQty: stock, pharmacyId: req.auth.pharmacyId });
        if (stock > 0) {
            await StockMovement.create({
                pharmacyId: req.auth.pharmacyId, medicineId: String(med._id), medicineName: med.medicineBrandName,
                type: "Added", change: stock, stockAfter: stock, note: "Opening stock", by: req.auth.staffLoginId,
            });
        }
        res.status(201).json({ success: true, message: "Medicine added.", data: toMedicine(med) });
    } catch (err) {
        const msg = dupMessage(err);
        if (msg) return res.status(400).json({ success: false, message: msg });
        throw err;
    }
}));

// Edit details. Stock is NOT changed here — use Restock or Correct stock (so every change is logged).
router.put("/inventory/:id", allowRoles(M, P, I), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const { data, error } = readMedicine(req.body || {}, true);
    if (error) return res.status(400).json({ success: false, message: error });

    const update = { $set: data };
    if (data.skuBarcodeReference === "") {
        delete data.skuBarcodeReference;
        update.$unset = { skuBarcodeReference: 1 };
    }
    try {
        const med = await Inventory.findOneAndUpdate({ _id: req.params.id, pharmacyId: req.auth.pharmacyId }, update, { new: true, runValidators: true });
        if (!med) return res.status(404).json({ success: false, message: "Medicine not found." });
        res.json({ success: true, message: "Medicine updated.", data: toMedicine(med) });
    } catch (err) {
        const msg = dupMessage(err);
        if (msg) return res.status(400).json({ success: false, message: msg });
        throw err;
    }
}));

router.delete("/inventory/:id", allowRoles(M, I), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const med = await Inventory.findOneAndDelete({ _id: req.params.id, pharmacyId: req.auth.pharmacyId });
    if (!med) return res.status(404).json({ success: false, message: "Medicine not found." });
    res.json({ success: true, message: "Medicine deleted. Old bills still show it." });
}));

// 📦 RESTOCK: new stock arrived (adds to the current stock, can update cost / price / batch / expiry)
router.post("/inventory/:id/restock", allowRoles(M, P, I), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const b = req.body || {};
    const qty = Math.round(num(b.quantity, 0));
    if (qty < 1 || qty > MAX_QTY) return res.status(400).json({ success: false, message: "Please enter how many arrived (1 or more)." });

    const set = {};
    const { data, error } = readMedicine(
        { costPrice: b.costPrice, unitPrice: b.unitPrice, expiryDate: b.expiryDate, batchNo: b.batchNo, supplier: b.supplier },
        true
    );
    if (error) return res.status(400).json({ success: false, message: error });
    for (const k of ["purchaseUnitCost", "retailPrice", "expirationDate", "batchNo", "supplierDistributor"]) {
        if (data[k] !== undefined && data[k] !== "" && data[k] !== null) set[k] = data[k];
    }

    const med = await Inventory.findOneAndUpdate(
        { _id: req.params.id, pharmacyId: req.auth.pharmacyId },
        { $inc: { initialStockQty: qty }, ...(Object.keys(set).length ? { $set: set } : {}) },
        { new: true }
    );
    if (!med) return res.status(404).json({ success: false, message: "Medicine not found." });

    const note = [str(b.note, 200), set.batchNo && `Batch ${set.batchNo}`, set.supplierDistributor && `from ${set.supplierDistributor}`]
        .filter(Boolean).join(" · ");
    await StockMovement.create({
        pharmacyId: req.auth.pharmacyId, medicineId: String(med._id), medicineName: med.medicineBrandName,
        type: "Restock", change: qty, stockAfter: med.initialStockQty, note, by: req.auth.staffLoginId,
    });
    res.json({ success: true, message: `Added ${qty} to ${med.medicineBrandName}.`, data: toMedicine(med) });
}));

// ✏️ CORRECT STOCK: set the real counted stock (broken, lost, expired thrown away, counting mistake)
router.post("/inventory/:id/adjust", allowRoles(M, P, I), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const newQty = Math.round(num(req.body?.newStock, NaN));
    const reason = str(req.body?.reason, 200);
    if (!Number.isFinite(newQty) || newQty < 0 || newQty > MAX_QTY) {
        return res.status(400).json({ success: false, message: "Please enter the correct stock (0 or more)." });
    }
    if (!reason) return res.status(400).json({ success: false, message: "Please write a reason (e.g. broken, expired, counting mistake)." });

    const before = await Inventory.findOne({ _id: req.params.id, pharmacyId: req.auth.pharmacyId });
    if (!before) return res.status(404).json({ success: false, message: "Medicine not found." });
    const change = newQty - (before.initialStockQty || 0);
    if (change === 0) return res.json({ success: true, message: "Stock is already correct.", data: toMedicine(before) });

    // Only change it if nobody sold in the meantime (otherwise ask to try again)
    const med = await Inventory.findOneAndUpdate(
        { _id: before._id, initialStockQty: before.initialStockQty },
        { $set: { initialStockQty: newQty } },
        { new: true }
    );
    if (!med) return res.status(409).json({ success: false, message: "Stock just changed (a sale happened). Please try again." });

    await StockMovement.create({
        pharmacyId: req.auth.pharmacyId, medicineId: String(med._id), medicineName: med.medicineBrandName,
        type: "Correction", change, stockAfter: newQty, note: reason, by: req.auth.staffLoginId,
    });
    res.json({ success: true, message: "Stock corrected.", data: toMedicine(med) });
}));

router.get("/stock-movements", allowRoles(M, P, I), wrap(async (req, res) => {
    const filter = { pharmacyId: req.auth.pharmacyId };
    if (isId(req.query.medicineId)) filter.medicineId = String(req.query.medicineId);
    const rows = await StockMovement.find(filter).sort({ createdAt: -1 }).limit(filter.medicineId ? 300 : 500).lean();
    res.json({ success: true, data: rows });
}));

// ---------- Suppliers ----------
const readSupplier = (b) => ({
    name: str(b.name, 120),
    contactName: str(b.contactName, 80),
    phone: str(b.phone, 30),
    address: str(b.address, 200),
    panNo: str(b.panNo, 30),
    note: str(b.note, 300),
});

router.get("/suppliers", allowRoles(M, P, I), wrap(async (req, res) => {
    const rows = await Supplier.find({ pharmacyId: req.auth.pharmacyId }).sort({ name: 1 }).lean();
    res.json({ success: true, data: rows });
}));

router.post("/suppliers", allowRoles(M, P, I), wrap(async (req, res) => {
    const data = readSupplier(req.body || {});
    if (!data.name) return res.status(400).json({ success: false, message: "Supplier name is required." });
    const s = await Supplier.create({ ...data, pharmacyId: req.auth.pharmacyId });
    res.status(201).json({ success: true, message: "Supplier added.", data: s });
}));

router.put("/suppliers/:id", allowRoles(M, P, I), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const data = readSupplier(req.body || {});
    if (!data.name) return res.status(400).json({ success: false, message: "Supplier name is required." });
    const s = await Supplier.findOneAndUpdate({ _id: req.params.id, pharmacyId: req.auth.pharmacyId }, { $set: data }, { new: true });
    if (!s) return res.status(404).json({ success: false, message: "Supplier not found." });
    res.json({ success: true, message: "Supplier updated.", data: s });
}));

router.delete("/suppliers/:id", allowRoles(M, I), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const s = await Supplier.findOneAndDelete({ _id: req.params.id, pharmacyId: req.auth.pharmacyId });
    if (!s) return res.status(404).json({ success: false, message: "Supplier not found." });
    res.json({ success: true, message: "Supplier deleted." });
}));

module.exports = { router, toMedicine, CATEGORIES };
