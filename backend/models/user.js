const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true, 
    },
    gender: {
        type: String,
        required: true, 
    },
    age: {
        type: String,
    },
    dob: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    address: {
        type: String,
    },
    nationalIdentityNumber : {
        type: String,
    },
    bloodGroup: {
        type: String,
    },
    language: {
        type: String,
    },
     drugSensitivities: {
        type: String,
    },
    chronicConditions: {
        type: String, 
    },
    emergencyContactPerson: {
        type: String,
    },
    emergencyContactPhone: {
        type: String,
    },
    pharmacyId: {
        type: String,
    },
    weight:{
        type:String,
    }
},
{
    timestamps: true, // FIXED: "Timestamp" changed to lowercase "timestamps"
});

const userModule = mongoose.model("User", userSchema);
module.exports = userModule;