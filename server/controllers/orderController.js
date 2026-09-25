// Customer-facing order endpoints.
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Store = require('../models/Store');
const { isValidId, round2 } = require('../utils/helpers');
const { reserveStock, restoreStock } = require('../utils/stock');

const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

function newOrderNo() {
  return 'PG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function shapeOrder(o, storeName) {
  return {
    id: o._id,
    orderNo: o.orderNo,
    storeId: o.storeId && o.storeId._id ? o.storeId._id : o.storeId,
    storeName: storeName || (o.storeId && o.storeId.name) || '',
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

// POST /api/orders   body: { items:[{productId, qty}], deliveryAddress, contactNumber, notes }
exports.create = async (req, res) => {
  try {
    const { items, deliveryAddress, contactNumber, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return res.status(400).json({ message: 'Your cart is empty (or has too many items).' });
    }

    const address = String(deliveryAddress || '').trim();
    const phone = String(contactNumber || '').trim();
    if (address.length < 8) {
      return res.status(400).json({ message: 'Please enter a complete delivery address.' });
    }
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: 'Please enter a valid contact number.' });
    }

    // Merge duplicate lines and validate quantities.
    const wanted = new Map();
    for (const line of items) {
      const qty = Number(line.qty);
      if (!isValidId(line.productId) || !Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ message: 'Invalid item in cart.' });
      }
      wanted.set(String(line.productId), (wanted.get(String(line.productId)) || 0) + qty);
    }

    const products = await Product.find({ _id: { $in: [...wanted.keys()] }, active: { $ne: false } });
    if (products.length !== wanted.size) {
      return res.status(400).json({ message: 'Some items in your cart are no longer available.' });
    }

    const storeIds = new Set(products.map((p) => String(p.storeId)));
    if (storeIds.size !== 1) {
      return res.status(400).json({ message: 'You can only order from one store at a time.' });
    }

    const store = await Store.findOne({ _id: products[0].storeId, status: 'approved' });
    if (!store) {
      return res.status(400).json({ message: 'This store is not accepting orders right now.' });
    }

    const orderItems = products.map((p) => ({
      product: p._id,
      name: p.name,
      brand: p.brand,
      sizeKg: p.sizeKg,
      unitPrice: p.effectivePrice, // always priced server-side
      qty: wanted.get(String(p._id)),
    }));

    try {
      await reserveStock(orderItems);
    } catch (err) {
      if (err.code === 'OUT_OF_STOCK') return res.status(409).json({ message: err.message });
      throw err;
    }

    const total = round2(orderItems.reduce((sum, it) => sum + it.unitPrice * it.qty, 0));

    let order;
    try {
      order = await Order.create({
        orderNo: newOrderNo(),
        customer: req.userId,
        storeId: store._id,
        items: orderItems,
        total,
        status: 'pending',
        statusHistory: [{ status: 'pending', at: new Date() }],
        deliveryAddress: address,
        contactNumber: phone,
        notes: String(notes || '').trim().slice(0, 200),
      });
    } catch (err) {
      await restoreStock(orderItems);
      throw err;
    }

    return res.status(201).json(shapeOrder(order, store.name));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// GET /api/orders/mine
exports.mine = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.userId }).populate('storeId', 'name').sort({ createdAt: -1 });
    return res.json(orders.map((o) => shapeOrder(o)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/orders/:id/received  - customer confirms the delivery arrived
exports.markReceived = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customer: req.userId, status: 'delivered' },
      { $set: { status: 'received' }, $push: { statusHistory: { status: 'received', at: new Date() } } },
      { new: true }
    ).populate('storeId', 'name');

    if (!order) {
      return res.status(400).json({ message: 'This order can only be confirmed once it is marked Delivered.' });
    }
    return res.json(shapeOrder(order));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/orders/:id/cancel  - only while the store hasn't accepted it yet
exports.cancel = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customer: req.userId, status: 'pending' },
      { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', at: new Date() } } },
      { new: true }
    ).populate('storeId', 'name');

    if (!order) {
      return res.status(400).json({ message: 'This order can no longer be cancelled.' });
    }
    await restoreStock(order.items);
    return res.json(shapeOrder(order));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

exports.shapeOrder = shapeOrder;
