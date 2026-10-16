// 🧾 Official bill numbers: every pharmacy gets 1, 2, 3 ... with no gaps or repeats,
// starting again from 1 each Nepali fiscal year. The SERVER gives the number.
//   invoiceNo example: "2082/83-00001"   credit note: "CN-2082/83-00001"
const Counter = require("../models/counter");
const { fiscalYear } = require("./nepaliDate");

async function next(key) {
    for (let attempt = 0; ; attempt++) {
        try {
            // $inc is atomic: two cashiers at the same second still get different numbers
            const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
            return doc.seq;
        } catch (err) {
            if (err.code !== 11000 || attempt >= 3) throw err;
        }
    }
}

async function nextBillNumber(pharmacyId, date = new Date()) {
    const fy = fiscalYear(date);
    const seq = await next(`${pharmacyId}:bill:${fy}`);
    return { fiscalYear: fy, invoiceNo: `${fy}-${String(seq).padStart(5, "0")}` };
}

async function nextCreditNoteNumber(pharmacyId, date = new Date()) {
    const fy = fiscalYear(date);
    const seq = await next(`${pharmacyId}:creditnote:${fy}`);
    return `CN-${fy}-${String(seq).padStart(5, "0")}`;
}

module.exports = { nextBillNumber, nextCreditNoteNumber };
