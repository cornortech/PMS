const mongoose = require("mongoose");

// ⚙️ Settings of one pharmacy (Settings page)
const settingsSchema = new mongoose.Schema(
    {
        pharmacyId: { type: String, required: true, unique: true },
        vatEnabled: { type: Boolean, default: true },
        vatRate: { type: Number, default: 13, min: 0, max: 100 },
        printSize: { type: String, enum: ["58mm", "80mm", "A4"], default: "80mm" },
        billFooter: { type: String, default: "Thank you! Get well soon.", trim: true },
        expiryAlertDays: { type: Number, default: 90, min: 1, max: 730 },
        allowDue: { type: Boolean, default: true }, // allow "Due / Pending" (udharo) bills
    },
    { timestamps: true }
);

module.exports = mongoose.model("PharmacySettings", settingsSchema);
