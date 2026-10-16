const mongoose = require("mongoose");

// 🧾 One bill (sale) with all its medicines.
// Prices are copied into the bill, so later price changes never change old bills.
const saleItemSchema = new mongoose.Schema(
    {
        medicineId: { type: String, required: true },
        name: { type: String, required: true },
        genericName: { type: String, default: "" },
        dosage: { type: String, default: "" },
        batchNo: { type: String, default: "" },
        expiryDate: { type: Date, default: null },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        costPrice: { type: Number, default: 0 },
        total: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const saleSchema = new mongoose.Schema(
    {
        pharmacyId: { type: String, required: true, index: true },
        invoiceNo: { type: String, required: true },   // e.g. 2082/83-00012 (given by the server)
        fiscalYear: { type: String, default: "" },
        dateBS: { type: String, default: "" },          // Nepali date of the bill
        customerName: { type: String, default: "Walk-in Customer", trim: true },
        customerPhone: { type: String, default: "", trim: true },
        patientId: { type: String, default: "" },
        items: { type: [saleItemSchema], default: [] },
        subTotal: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        taxableAmount: { type: Number, default: 0 },
        vatRate: { type: Number, default: 0 },
        vatAmount: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
        profit: { type: Number, default: 0 },           // grand total (without VAT) − cost of medicines
        paymentMethod: { type: String, default: "Cash" }, // Cash / eSewa / Khalti / Fonepay / Bank / Due
        status: { type: String, enum: ["paid", "pending", "cancelled"], default: "paid", index: true },
        paidAt: { type: Date, default: null },          // when the money was received
        note: { type: String, default: "", trim: true },
        soldBy: { type: String, default: "" },          // staff ID who made the bill
        cancelReason: { type: String, default: "" },
        cancelledAt: { type: Date, default: null },
        cancelledBy: { type: String, default: "" },
        creditNoteNo: { type: String, default: "" },
        clientRequestId: { type: String },              // stops the same bill being saved twice
    },
    { timestamps: true }
);

saleSchema.index({ pharmacyId: 1, createdAt: -1 });
saleSchema.index({ pharmacyId: 1, invoiceNo: 1 }, { unique: true });
saleSchema.index(
    { pharmacyId: 1, clientRequestId: 1 },
    { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);

module.exports = mongoose.model("Sale", saleSchema);
