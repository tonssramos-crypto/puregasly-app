const mongoose = require('mongoose');
const { encryptedField } = require('../utils/fieldCrypto');

const addressSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 40 }, // e.g. "Home", "Work"
    // Personal data - encrypted at rest (see utils/fieldCrypto.js). The real
    // limits (250 / 30 chars) are enforced in the controller; maxlength here
    // only has to leave room for the ciphertext.
    address: { type: String, required: true, maxlength: 2000, ...encryptedField },
    contactNumber: { type: String, required: true, maxlength: 500, ...encryptedField },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Address', addressSchema);
