const mongoose = require("mongoose");

// 🏥 One pharmacy account (and the super admin account, isAdmin: true)
const pharmacyUserSchema = new mongoose.Schema(
    {
        pharmacyName: { type: String, required: true, trim: true },
        id: { type: String, required: true, trim: true },          // login ID, also used as "pharmacyId" on all data
        password: { type: String, required: true, select: false }, // bcrypt hash (old plain ones are upgraded on login)
        phone: { type: String, default: "", trim: true },
        email: { type: String, default: "", trim: true, lowercase: true },
        location: { type: String, default: "", trim: true },
        PanOrVat: { type: String, default: "", trim: true },
        isActive: { type: Boolean, default: true },
        isAdmin: { type: Boolean, default: false },
        // 📅 Subscription plan (days) — set by the super admin
        totalTime: { type: Number, default: 30 },
        remainingTime: { type: Number, default: 30 },
        lastTimeSync: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

pharmacyUserSchema.index({ id: 1 });
module.exports = mongoose.model("PharmacyUser", pharmacyUserSchema);
