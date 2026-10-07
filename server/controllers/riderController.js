const User = require('../models/User');
const Order = require('../models/Order');

function toSafeRider(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    banned: !!user.banned,
    banReason: user.banReason || '',
    createdAt: user.createdAt,
  };
}

// GET /api/riders - this store's riders
exports.list = async (req, res) => {
  try {
    const riders = await User.find({ storeId: req.currentStore._id, role: 'rider' }).sort({ createdAt: -1 });
    return res.json(riders.map(toSafeRider));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/riders
exports.create = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters and include a letter and a number.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    let rider;
    try {
      rider = await User.create({
        name: String(name).trim().slice(0, 80),
        email: normalizedEmail,
        password,
        role: 'rider',
        storeId: req.currentStore._id,
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
      throw err;
    }

    return res.status(201).json(toSafeRider(rider));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/riders/:id
exports.remove = async (req, res) => {
  try {
    const rider = await User.findOneAndDelete({
      _id: req.params.id,
      storeId: req.currentStore._id,
      role: 'rider',
    });

    if (!rider) return res.status(404).json({ message: 'Rider not found.' });

    // Don't leave orders pointing at a deleted rider.
    await Order.updateMany({ rider: rider._id }, { $set: { rider: null } });

    return res.json({ message: 'Rider removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
