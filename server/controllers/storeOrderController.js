// Store-facing order endpoints (owner, or employee with manage_orders).
const Order = require('../models/Order');
const Product = require('../models/Product');
const { ORDER_STATUSES } = require('../models/Order');
const { restoreStock } = require('../utils/stock');

// The only moves a store may make. The customer does delivered -> received.
const NEXT = {
  pending: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

function shape(o) {
  return {
    id: o._id,
    orderNo: o.orderNo,
    customer: o.customer && o.customer.name ? { name: o.customer.name, email: o.customer.email } : null,
    items: o.items,
    total: o.total,
    status: o.status,
    statusHistory: o.statusHistory,
    deliveryAddress: o.deliveryAddress,
    contactNumber: o.contactNumber,
    notes: o.notes,
    paymentMethod: o.paymentMethod,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// GET /api/store-orders?status=
exports.list = async (req, res) => {
  try {
    const filter = { storeId: req.currentUser.storeId };
    if (ORDER_STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const orders = await Order.find(filter).populate('customer', 'name email').sort({ createdAt: -1 }).limit(300);
    return res.json(orders.map(shape));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/store-orders/:id/advance  - moves the order one step forward
exports.advance = async (req, res) => {
  try {
    const current = await Order.findOne({ _id: req.params.id, storeId: req.currentUser.storeId });
    if (!current) return res.status(404).json({ message: 'Order not found.' });

    const next = NEXT[current.status];
    if (!next) {
      return res.status(400).json({ message: 'This order cannot be moved forward any more.' });
    }

    // Guarding on the current status means a double-click can't skip a step.
    const order = await Order.findOneAndUpdate(
      { _id: current._id, status: current.status },
      { $set: { status: next }, $push: { statusHistory: { status: next, at: new Date() } } },
      { new: true }
    ).populate('customer', 'name email');

    if (!order) return res.status(409).json({ message: 'This order was just updated. Please refresh.' });

    // Sales are counted once the order is delivered.
    if (next === 'delivered') {
      await Promise.all(
        order.items.map((it) => Product.updateOne({ _id: it.product }, { $inc: { sold: it.qty } }))
      );
    }

    return res.json(shape(order));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/store-orders/:id/decline  - only while still pending
exports.decline = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, storeId: req.currentUser.storeId, status: 'pending' },
      { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', at: new Date() } } },
      { new: true }
    ).populate('customer', 'name email');

    if (!order) return res.status(400).json({ message: 'Only new orders can be declined.' });

    await restoreStock(order.items);
    return res.json(shape(order));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
