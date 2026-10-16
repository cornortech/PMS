// 📅 Works out how many subscription days a pharmacy has left.
// Pharmacies are only BLOCKED when ENFORCE_SUBSCRIPTION=true (Render → Environment).
const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(pharmacy) {
    const base = pharmacy.remainingTime ?? pharmacy.totalTime;
    if (base === undefined || base === null) return Infinity;
    const last = pharmacy.lastTimeSync || pharmacy.createdAt;
    const passed = last ? Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / DAY_MS)) : 0;
    return base - passed;
}

function isExpired(pharmacy) {
    if (process.env.ENFORCE_SUBSCRIPTION !== "true") return false;
    if (pharmacy.isAdmin) return false;
    return daysLeft(pharmacy) <= 0;
}

const EXPIRED_MESSAGE = "Your Argya Health subscription has expired. Please contact us to renew.";

module.exports = { daysLeft, isExpired, EXPIRED_MESSAGE, DAY_MS };
