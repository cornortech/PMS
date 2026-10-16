// =====================================================================
// 🏥 PATIENTS and 🩺 EMR (medical records)
// Each pharmacy sees ONLY its own patients (before, every pharmacy could see all of them).
// =====================================================================
const express = require("express");
const Patient = require("../models/user");
const EMR = require("../models/emr");
const { allowRoles } = require("../utils/auth");
const { str, isId, wrap } = require("../utils/helpers");

const router = express.Router();
const M = "Manager", P = "Pharmacist", B = "Accounts & Billing Officer", I = "Inventory Manager", D = "Doctor", R = "Receptionist";

const getValue = (val, fallback) => (val !== undefined && val !== null && String(val).trim() !== "" ? String(val).trim().slice(0, 300) : fallback);
const listOrString = (arr, s, fallback = "None") => {
    if (Array.isArray(arr)) {
        const clean = arr.map((x) => str(String(x ?? ""), 80)).filter(Boolean).slice(0, 30);
        return clean.length ? clean.join(", ") : fallback;
    }
    return getValue(s, fallback);
};
const asList = (v) => (v && v !== "None" ? String(v).split(", ").filter(Boolean) : []);

const toPatient = (p) => ({
    id: String(p._id),
    _id: String(p._id),
    name: p.name,
    fullName: p.name,
    phone: p.phoneNumber,
    phoneNumber: p.phoneNumber,
    gender: p.gender,
    age: p.age,
    dob: p.dob,
    address: p.address,
    nationalId: p.nationalIdentityNumber,
    nationalIdentityNumber: p.nationalIdentityNumber,
    bloodType: p.bloodGroup,
    bloodGroup: p.bloodGroup,
    preferredLanguage: p.language,
    language: p.language,
    drugSensitivities: p.drugSensitivities,
    allergies: asList(p.drugSensitivities),
    chronicConditions: asList(p.chronicConditions),
    emergencyContactName: p.emergencyContactPerson,
    emergencyContactPerson: p.emergencyContactPerson,
    emergencyContactPhone: p.emergencyContactPhone,
    pharmacyId: p.pharmacyId,
    weight: p.weight,
    createdAt: p.createdAt,
});

const readPatient = (f) => ({
    name: getValue(f.name || f.fullName, ""),
    gender: getValue(f.gender, "Not Specified"),
    age: getValue(f.age, ""),
    dob: getValue(f.dob, "Unknown"),
    phoneNumber: getValue(f.phoneNumber || f.phone, ""),
    address: getValue(f.address, ""),
    nationalIdentityNumber: getValue(f.nationalIdentityNumber || f.nationalId, ""),
    bloodGroup: getValue(f.bloodGroup || f.bloodType, ""),
    language: getValue(f.language || f.preferredLanguage, ""),
    drugSensitivities: listOrString(f.allergies, f.drugSensitivities),
    chronicConditions: listOrString(f.chronicConditions, f.chronicConditions),
    emergencyContactPerson: getValue(f.emergencyContactPerson || f.emergencyContactName, ""),
    emergencyContactPhone: getValue(f.emergencyContactPhone, ""),
    weight: getValue(f.weight, ""),
});

router.get("/patients", allowRoles(M, P, B, I, D, R), wrap(async (req, res) => {
    const rows = await Patient.find({ pharmacyId: req.auth.pharmacyId }).sort({ createdAt: -1 }).limit(20000).lean();
    res.json({ success: true, count: rows.length, data: rows.map(toPatient) });
}));

router.post("/patients", allowRoles(M, P, B, D, R), wrap(async (req, res) => {
    const data = readPatient(req.body || {});
    if (!data.name) return res.status(400).json({ success: false, message: "Patient name is required." });
    if (!data.phoneNumber) return res.status(400).json({ success: false, message: "Phone number is required." });
    const p = await Patient.create({ ...data, pharmacyId: req.auth.pharmacyId });
    res.status(201).json({ success: true, message: "Patient record saved!", data: toPatient(p) });
}));

router.put("/patients/:id", allowRoles(M, P, B, D, R), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const data = readPatient(req.body || {});
    if (!data.name) return res.status(400).json({ success: false, message: "Patient name is required." });
    if (!data.phoneNumber) return res.status(400).json({ success: false, message: "Phone number is required." });
    const p = await Patient.findOneAndUpdate({ _id: req.params.id, pharmacyId: req.auth.pharmacyId }, { $set: data }, { new: true });
    if (!p) return res.status(404).json({ success: false, message: "Patient record not found." });
    res.json({ success: true, message: "Patient record updated!", data: toPatient(p) });
}));

router.delete("/patients/:id", allowRoles(M), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const p = await Patient.findOneAndDelete({ _id: req.params.id, pharmacyId: req.auth.pharmacyId });
    if (!p) return res.status(404).json({ success: false, message: "Patient record not found." });
    await EMR.deleteMany({ patientId: String(p._id), pharmacyId: req.auth.pharmacyId });
    res.json({ success: true, message: "Patient record deleted.", deletedPatientId: req.params.id });
}));

// ---------- EMR ----------
const toRecord = (r) => ({
    id: String(r._id),
    _id: String(r._id),
    patientId: r.patientId,
    pharmacyId: r.pharmacyId,
    visitDate: r.visitDate,
    chiefComplaint: r.chiefComplaint,
    diagnosis: r.diagnosis,
    symptoms: r.symptoms || [],
    vitals: r.vitals || {},
    prescription: r.prescription,
    labTests: r.labTests || [],
    notes: r.notes,
    followUpDate: r.followUpDate,
    doctorName: r.doctorName,
    createdAt: r.createdAt,
});

const strList = (v) => (Array.isArray(v) ? v.map((x) => str(String(x ?? ""), 120)).filter(Boolean).slice(0, 50) : []);
const readRecord = (f) => ({
    visitDate: getValue(f.visitDate, ""),
    chiefComplaint: getValue(f.chiefComplaint, ""),
    diagnosis: getValue(f.diagnosis, ""),
    symptoms: strList(f.symptoms),
    vitals: {
        bp: getValue(f.vitals?.bp, ""),
        temp: getValue(f.vitals?.temp, ""),
        pulse: getValue(f.vitals?.pulse, ""),
        weight: getValue(f.vitals?.weight, ""),
        spo2: getValue(f.vitals?.spo2, ""),
    },
    prescription: typeof f.prescription === "string" ? f.prescription.slice(0, 5000) : "",
    labTests: strList(f.labTests),
    notes: typeof f.notes === "string" ? f.notes.slice(0, 5000) : "",
    followUpDate: getValue(f.followUpDate, ""),
    doctorName: getValue(f.doctorName, ""),
});

const EMR_READ = [M, P, D, R], EMR_WRITE = [M, D, R];

router.get("/emr", allowRoles(...EMR_READ), wrap(async (req, res) => {
    const rows = await EMR.find({ pharmacyId: req.auth.pharmacyId }).sort({ visitDate: -1 }).limit(20000).lean();
    res.json({ success: true, count: rows.length, data: rows.map(toRecord) });
}));

router.get("/emr/patient/:patientId", allowRoles(...EMR_READ), wrap(async (req, res) => {
    const rows = await EMR.find({ pharmacyId: req.auth.pharmacyId, patientId: str(req.params.patientId, 40) }).sort({ visitDate: -1 }).lean();
    res.json({ success: true, count: rows.length, data: rows.map(toRecord) });
}));

router.get("/emr/:id", allowRoles(...EMR_READ), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const r = await EMR.findOne({ _id: req.params.id, pharmacyId: req.auth.pharmacyId }).lean();
    if (!r) return res.status(404).json({ success: false, message: "EMR record not found." });
    res.json({ success: true, data: toRecord(r) });
}));

router.post("/emr", allowRoles(...EMR_WRITE), wrap(async (req, res) => {
    const f = req.body || {};
    const data = readRecord(f);
    const patientId = str(f.patientId, 40);
    if (!patientId || !data.visitDate || !data.chiefComplaint) {
        return res.status(400).json({ success: false, message: "Patient, visit date and chief complaint are required." });
    }
    if (!isId(patientId) || !(await Patient.exists({ _id: patientId, pharmacyId: req.auth.pharmacyId }))) {
        return res.status(400).json({ success: false, message: "Patient not found." });
    }
    const r = await EMR.create({ ...data, patientId, pharmacyId: req.auth.pharmacyId });
    res.status(201).json({ success: true, message: "EMR record saved!", data: toRecord(r) });
}));

router.put("/emr/:id", allowRoles(...EMR_WRITE), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const data = readRecord(req.body || {});
    if (!data.visitDate || !data.chiefComplaint) {
        return res.status(400).json({ success: false, message: "Visit date and chief complaint are required." });
    }
    const r = await EMR.findOneAndUpdate({ _id: req.params.id, pharmacyId: req.auth.pharmacyId }, { $set: data }, { new: true });
    if (!r) return res.status(404).json({ success: false, message: "EMR record not found." });
    res.json({ success: true, message: "EMR record updated!", data: toRecord(r) });
}));

router.delete("/emr/:id", allowRoles(M, D), wrap(async (req, res) => {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id." });
    const r = await EMR.findOneAndDelete({ _id: req.params.id, pharmacyId: req.auth.pharmacyId });
    if (!r) return res.status(404).json({ success: false, message: "EMR record not found." });
    res.json({ success: true, message: "EMR record deleted!", deletedRecordId: req.params.id });
}));

module.exports = { router };
