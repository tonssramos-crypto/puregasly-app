const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Store = require('../models/Store');
const accessGate = require('../utils/accessGate');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isStrongEnough(password) {
  // At least 8 characters, at least one letter and one number.
  return typeof password === 'string' && password.length >= 8 && password.length <= 128 &&
    /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2h' });
}

function toSafeUser(user) {
  const s = user.storeId && user.storeId.name ? user.storeId : null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    store: s
      ? {
          id: s._id,
          name: s.name,
          status: s.status,
          banReason: s.banReason,
          rejectionReason: s.rejectionReason,
          address: s.address,
          phone: s.phone,
          description: s.description,
          appeal: s.appeal
            ? {
                status: s.appeal.status,
                message: s.appeal.message,
                submittedAt: s.appeal.submittedAt,
                adminNote: s.appeal.adminNote,
              }
            : { status: 'none' },
        }
      : null,
  };
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, storeName } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const trimmedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return res.status(400).json({ message: 'Please enter your full name.' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (!isStrongEnough(password)) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters and include a letter and a number.' });
    }

    if (!['customer', 'owner'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role for self-registration.' });
    }

    if (role === 'owner' && (!storeName || String(storeName).trim().length < 2)) {
      return res.status(400).json({ message: 'Store name is required for store owners.' });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const user = await User.create({ name: trimmedName, email: normalizedEmail, password, role });

    if (role === 'owner') {
      // New stores wait for admin approval before the owner can log in.
      const store = await Store.create({
        name: String(storeName).trim().slice(0, 80),
        owner: user._id,
        status: 'pending',
      });
      user.storeId = store._id;
      await user.save();

      return res.status(201).json({
        message: 'Application submitted. An admin needs to approve your store before you can log in.',
        pendingApproval: true,
      });
    }

    return res.status(201).json({ message: 'Account created successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail })
      .select('+password')
      .populate('storeId');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Only reveal ban / approval status once the password was correct.
    const blocked = accessGate(user, user.storeId);
    if (blocked) {
      return res.status(403).json(blocked);
    }

    const token = signToken(user._id);

    return res.json({
      message: 'Login successful.',
      token,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('storeId');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json(toSafeUser(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
