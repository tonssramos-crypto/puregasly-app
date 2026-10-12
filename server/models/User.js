const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
  },
  { timestamps: true }
);

// Hash the password before saving, only if it changed.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.hasPermission = function (permission) {
  if (this.role === 'owner') return true;
  return this.permissions.includes(permission);
};

module.exports = mongoose.model('User', userSchema);
