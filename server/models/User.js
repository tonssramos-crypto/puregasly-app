const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 12 rounds (~250ms/hash) - the old value of 10 is below current guidance.
// Accounts hashed with fewer rounds are upgraded automatically at next login.
const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'owner', 'employee', 'rider', 'customer'],
      default: 'customer',
    },
    // Links owners AND employees to their store. Null for admin/customer.
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
    // Set by the store owner, employees only. e.g. ["manage_inventory"]
    permissions: { type: [String], default: [] },
    // Set by the platform admin. A banned user cannot log in or use the API.
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    bannedAt: { type: Date, default: null },
    // Account lockout after repeated failed login attempts.
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    // Access tokens issued before this moment are rejected (set on password change).
    passwordChangedAt: { type: Date, default: null },
    // Privacy consent: which policy version the user accepted, and when.
    consentVersion: { type: String, default: '' },
    consentAcceptedAt: { type: Date, default: null },
    // Set when the user erased their account. The row is kept (anonymised) so
    // order history and reviews that reference it stay intact.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash the password before saving, only if it changed.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// True when the stored hash was made with fewer rounds than we use today.
userSchema.methods.needsRehash = function () {
  try {
    return bcrypt.getRounds(this.password) < BCRYPT_ROUNDS;
  } catch {
    return false;
  }
};

userSchema.methods.hasPermission = function (permission) {
  if (this.role === 'owner') return true;
  return this.permissions.includes(permission);
};

module.exports = mongoose.model('User', userSchema);
module.exports.BCRYPT_ROUNDS = BCRYPT_ROUNDS;
