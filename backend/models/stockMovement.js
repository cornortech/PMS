const mongoose = require("mongoose");

// 📦 Every change of stock is written here (restock, sale, cancelled bill, manual correction)
const stockMovementSchema = new mongoose.Schema(
    {
        pharmacyId: { type: String, required: true },
        medicineId: { type: String, required: true },
        medicineName: { type: String, default: "" },
        type: { type: String, enum: ["Added", "Restock", "Sale", "Bill cancelled", "Correction"], required: true },
        change: { type: Number, required: true },   // + in, − out
        stockAfter: { type: Number, default: 0 },
        note: { type: String, default: "" },
        by: { type: String, default: "" },
    },
    { timestamps: true }
);

stockMovementSchema.index({ pharmacyId: 1, createdAt: -1 });
stockMovementSchema.index({ pharmacyId: 1, medicineId: 1, createdAt: -1 });
module.exports = mongoose.model("StockMovement", stockMovementSchema);
