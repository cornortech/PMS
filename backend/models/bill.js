const mongoose = require("mongoose");

const billingSchema = mongoose.Schema({
    pharmacyName:{
        type:String,
    },
    location:{
        type:String,
    },
    panOrVat:{
        type:String,
    },
    invoiceNo: {
        type: String,
    },
    billTo: {
        type: String,
    },
    paymentMethod: {
        type: String,
    },
    date: {
        type: Date, 
    },
    item: {
        type: String, 
    },
    qty: {       
        type: Number, 
        default: 1
    },
    rate: {
        type: Number, 
        default: 0,
    },
    total: {
        type: Number, 
    },
    subtotal: {
        type: Number, 
    },
    taxablePostsubdiscountSubtotal: {
        type: Number,  
    },
    vATCollected: {
        type: Number, 
    },
    grandTotal: {    
        type: Number,
    },
         pharmacyId: {
        type: String,
    },
},
{
    timestamps: true, 
});

const Bill = mongoose.model("Bill", billingSchema);
module.exports = Bill;