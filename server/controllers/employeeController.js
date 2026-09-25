const User = require('../models/User');

const VALID_PERMISSIONS = ['manage_inventory', 'manage_orders', 'view_analytics', 'manage_riders'];

function sanitizePermissions(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((p) => VALID_PERMISSIONS.includes(p));
}

function toSafeEmployee(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    permissions: user.permissions,
    createdAt: user.createdAt,
  };
}

// GET /api/employees - list this owner's employees
exports.list = async (req, res) => {
  try {
    const owner = req.currentUser; // set by requireRole middleware

    if (!owner.storeId) {
      return res.status(400).json({ message: 'You do not have a store set up yet.' });
    }

    const employees = await User.find({ storeId: owner.storeId, role: 'employee' }).sort({
      createdAt: -1,
    });

    return res.json(employees.map(toSafeEmployee));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/employees - create a new employee under this owner's store
exports.create = async (req, res) => {
  try {
    const owner = req.currentUser;
    const { name, email, password, permissions } = req.body;

    if (!owner.storeId) {
      return res.status(400).json({ message: 'You do not have a store set up yet.' });
    }

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

    const employee = await User.create({
      name: String(name).trim().slice(0, 80),
      email: normalizedEmail,
      password,
      role: 'employee',
      storeId: owner.storeId,
      permissions: sanitizePermissions(permissions),
    });

    return res.status(201).json(toSafeEmployee(employee));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/employees/:id - update an employee's permissions
exports.updatePermissions = async (req, res) => {
  try {
    const owner = req.currentUser;
    const { permissions } = req.body;

    const employee = await User.findOne({
      _id: req.params.id,
      storeId: owner.storeId,
      role: 'employee',
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    employee.permissions = sanitizePermissions(permissions);
    await employee.save();

    return res.json(toSafeEmployee(employee));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/employees/:id - remove an employee from this owner's store
exports.remove = async (req, res) => {
  try {
    const owner = req.currentUser;

    const employee = await User.findOneAndDelete({
      _id: req.params.id,
      storeId: owner.storeId,
      role: 'employee',
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    return res.json({ message: 'Employee removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

exports.VALID_PERMISSIONS = VALID_PERMISSIONS;
