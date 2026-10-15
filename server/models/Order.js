const mongoose = require('mongoose');
const { encryptedField } = require('../utils/fieldCrypto');

const ORDER_STATUSES = ['pending', 'preparing', 'out_for_delivery', 'delivered', 'received', 'cancelled'];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    brand: { type: String, default: '' },
    sizeKg: { type: Number },
    unitPrice: { type: Number, required: true, min: 0 }, // price at the time of ordering
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 }, // before any coupon discount
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: '' },
    total: { type: Number, required: true, min: 0 }, // subtotal - discount
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: ORDER_STATUSES },
        at: { type: Date, default: Date.now },
      },
    ],
    // Personal data - encrypted at rest (see utils/fieldCrypto.js). Real length
    // limits are enforced in the controllers; maxlength only leaves room for ciphertext.
    deliveryAddress: { type: String, required: true, maxlength: 2000, ...encryptedField },
    contactNumber: { type: String, required: true, maxlength: 500, ...encryptedField },
    notes: { type: String, default: '', maxlength: 2000, ...encryptedField },
    // True once the retention job (or account erasure) has removed the personal fields.
    piiScrubbed: { type: Boolean, default: false },
    paymentMethod: { type: String, enum: ['COD'], default: 'COD' },
    // Optional - the store can hand a preparing/out-for-delivery order to a rider,
    // who then owns the out_for_delivery -> delivered steps for it.
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
