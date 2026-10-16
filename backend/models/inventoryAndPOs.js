const mongoose = require("mongoose");

// 💊 One medicine in a pharmacy's stock.
// Field names are kept the same as before so old data keeps working.
const medicineInventorySchema = new mongoose.Schema(
    {
        pharmacyId: { type: String, required: true, index: true },
        medicineBrandName: { type: String, required: true, trim: true },
        genericMoleculeName: { type: String, default: "", trim: true },
        categoryType: { type: String, default: "Tablet", trim: true },
        dosageStrength: { type: String, default: "", trim: true },
        purchaseUnitCost: { type: Number, default: 0, min: 0 },
        retailPrice: { type: Number, default: 0, min: 0 },
        initialStockQty: { type: Number, default: 0, min: 0 }, // = current stock
        reorderThresholdAlert: { type: Number, default: 10, min: 0 },
        skuBarcodeReference: { type: String, trim: true },      // optional, unique per pharmacy
        expirationDate: { type: Date, default: null },
        supplierDistributor: { type: String, default: "", trim: true },
        batchNo: { type: String, default: "", trim: true },
        rackLocation: { type: String, default: "", trim: true }, // e.g. "Shelf A3"
        unit: { type: String, default: "pcs", trim: true },      // pcs, strip, bottle, tube...
    },
    { timestamps: true }
);

// A barcode can't repeat inside the SAME pharmacy (other pharmacies may use the same barcode)
medicineInventorySchema.index(
    { pharmacyId: 1, skuBarcodeReference: 1 },
    { unique: true, partialFilterExpression: { skuBarcodeReference: { $type: "string" } } }
);

module.exports = mongoose.model("InventoryAndPO", medicineInventorySchema);
