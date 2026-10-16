const mongoose = require("mongoose");

// 🚚 Medicine suppliers / distributors of a pharmacy
const supplierSchema = new mongoose.Schema(
    {
        pharmacyId: { type: String, required: true, index: true },
        name: { type: String, required: true, trim: true },
        contactName: { type: String, default: "", trim: true },
        phone: { type: String, default: "", trim: true },
        address: { type: String, default: "", trim: true },
        panNo: { type: String, default: "", trim: true },
        note: { type: String, default: "", trim: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Supplier", supplierSchema);
