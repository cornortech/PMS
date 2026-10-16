// 🛠️ Run ONCE on your computer to create the super admin account (only if none exists yet):
//    1. In backend/.env put: MONGODB_URI=...  ADMIN_ID=...  ADMIN_PASSWORD=... (12+ characters)
//    2. Run: node seedAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const PharmacyUser = require("./models/login");

(async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGODB_URI is missing in backend/.env");
        await mongoose.connect(uri);
        if (await PharmacyUser.exists({ isAdmin: true })) {
            console.log("⚠️ An admin account already exists. Nothing changed.");
            process.exit(0);
        }
        const id = (process.env.ADMIN_ID || "").trim();
        const password = process.env.ADMIN_PASSWORD || "";
        if (!id || password.length < 12) throw new Error("Set ADMIN_ID and ADMIN_PASSWORD (at least 12 characters) in backend/.env first.");
        await PharmacyUser.create({
            pharmacyName: "Admin",
            id,
            password: await bcrypt.hash(password, 12),
            phone: "",
            email: process.env.ADMIN_OTP_EMAIL || "",
            location: "Argya Health",
            isAdmin: true,
            isActive: true,
        });
        console.log(`✅ Admin created. Log in with pharmacy name "Admin", ID "${id}" and your password.`);
        process.exit(0);
    } catch (err) {
        console.error("❌", err.message);
        process.exit(1);
    }
})();
