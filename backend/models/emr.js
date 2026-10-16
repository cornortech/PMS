const mongoose = require("mongoose");

const emrSchema = mongoose.Schema({
    patientId: { type: String, required: true },
    pharmacyId: { type: String, required: true },
    visitDate: { type: String, required: true },
    chiefComplaint: { type: String, required: true },
    diagnosis: { type: String },
    symptoms: { type: [String], default: [] },
    vitals: {
        bp: { type: String },
        temp: { type: String },
        pulse: { type: String },
        weight: { type: String },
        spo2: { type: String },
    },
    prescription: { type: String },
    labTests: { type: [String], default: [] },
    notes: { type: String },
    followUpDate: { type: String },
    doctorName: { type: String },
},
{
    timestamps: true,
});

const emrModule = mongoose.model("EMR", emrSchema);
module.exports = emrModule;