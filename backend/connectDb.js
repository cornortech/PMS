const mongoose = require("mongoose");

async function connectDb() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("Missing MONGODB_URI (Render → Environment)");
    await mongoose.connect(uri);
    console.log("✅ Database Connected Successfully.");
}

module.exports = connectDb;
