const mongoose = require("mongoose");

// 👥 Staff of one pharmacy. They sign in on a computer that is already logged in as that pharmacy.
const pharmacyStaffSchema = new mongoose.Schema(
    {
        staffName: { type: String, trim: true },
        pharmacyName: { type: String, trim: true },
        id: { type: String, required: true, trim: true },
        password: { type: String, required: true, select: false },
        role: { type: String, default: "Pharmacist" },
        isActive: { type: Boolean, default: true },
        // 🖐️ Fingerprint machine user number (e.g. "101"). Fingerprints stay inside the machine.
        deviceUserId: { type: String, default: "" },
    },
    { timestamps: true }
);

pharmacyStaffSchema.index({ pharmacyName: 1, id: 1 });
module.exports = mongoose.model("PharmacyStaff", pharmacyStaffSchema);
