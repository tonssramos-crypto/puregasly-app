const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // pending  -> waiting for admin approval (new registrations)
    // approved -> live, visible to customers
    // rejected -> admin declined the application
    // banned   -> suspended by admin; only the owner can log in (to send an appeal)
    //
    // Default is 'approved' so stores created before this phase keep working.
    // New registrations explicitly set 'pending'.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'banned'],
      default: 'approved',
    },
    rejectionReason: { type: String, default: '' },
    banReason: { type: String, default: '' },
    bannedAt: { type: Date, default: null },

    // Owner-editable public info shown to customers.
    address: { type: String, trim: true, default: '', maxlength: 200 },
    phone: { type: String, trim: true, default: '', maxlength: 30 },
    description: { type: String, trim: true, default: '', maxlength: 300 },

    // Customization (owner-editable once approved). Images are Media ids.
    logo: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', default: null },
    cover: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', default: null },
    gallery: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }], default: [] },
    accentColor: { type: String, default: '' },
    openingHours: { type: String, trim: true, default: '', maxlength: 120 },

    // Delivery settings (owner-editable). All in pesos; 0 means "not set".
    deliveryFee: { type: Number, default: 0, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 }, // items total needed to place an order
    freeDeliveryOver: { type: Number, default: 0, min: 0 }, // items total that waives the fee

    // Re-appeal for a banned store.
    appeal: {
      status: { type: String, enum: ['none', 'pending', 'approved', 'denied'], default: 'none' },
      message: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
      resolvedAt: { type: Date, default: null },
      adminNote: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Store', storeSchema);
