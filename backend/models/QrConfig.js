const mongoose = require('mongoose');

const QrConfigSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    pharmacyName: {
      type: String,
      required: true,
      trim: true,
    },
    providerName: {
      type: String, 
      required: true,
      trim: true,
    },
    staticPayload: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Many QRs per pharmacy, but only ONE per provider (eSewa / Khalti / Fonepay)
QrConfigSchema.index({ pharmacyId: 1, providerName: 1 }, { unique: true });

module.exports = mongoose.model('QrConfig', QrConfigSchema);