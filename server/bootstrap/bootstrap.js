const User = require('../models/User');
const Store = require('../models/Store');
const Order = require('../models/Order');
const logger = require('../utils/logger');

// Built-in platform admin. Created automatically on server start if it doesn't
// exist yet.
//
//  - ADMIN_EMAIL    optional, defaults to PGAdmin@pgas.com
//  - ADMIN_PASSWORD REQUIRED in production (min 12 chars). There is NO built-in
//    default any more: the old published default let anyone who had read the
//    repository log in as admin. In development, if it's unset, a random
//    password is generated and printed once.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const RefreshToken = require('../models/RefreshToken');

const ADMIN_NAME = 'PureGasly Admin';
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'PGAdmin@pgas.com').trim().toLowerCase();
const ADMIN_PASSWORD_MIN = 12;

// The password that used to ship in the source code / .env.example.
const LEGACY_DEFAULT_PASSWORD = 'Pg@s365T';

function adminPasswordProblem(pw) {
  if (pw.length < ADMIN_PASSWORD_MIN) return `must be at least ${ADMIN_PASSWORD_MIN} characters`;
  if (pw === LEGACY_DEFAULT_PASSWORD) return 'must not be the old published default';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'must include a letter and a number';
  return null;
}

function generatePassword() {
  // 18 random chars, guaranteed to contain a letter and a digit.
  return crypto.randomBytes(14).toString('base64url').slice(0, 16) + 'a7';
}

async function ensureBuiltInAdmin() {
  const isProd = process.env.NODE_ENV === 'production';
  const envPassword = process.env.ADMIN_PASSWORD;

  if (envPassword) {
    const problem = adminPasswordProblem(envPassword);
    if (problem) throw new Error(`ADMIN_PASSWORD ${problem}.`);
  }

  const existing = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

  if (!existing) {
    let password = envPassword;
    let generated = false;
    if (!password) {
      if (isProd) {
        throw new Error('ADMIN_PASSWORD must be set in production to create the first admin account.');
      }
      password = generatePassword();
      generated = true;
    }
    await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password, role: 'admin' });
    logger.info(`Built-in admin created: ${ADMIN_EMAIL}`);
    if (generated) {
      logger.info(`Generated ADMIN password (shown once, development only): ${password}`);
      logger.info('Set ADMIN_PASSWORD in server/.env to choose your own.');
    }
    return;
  }

  // An admin that was created by an older version still has the published default.
  const stillDefault = await bcrypt.compare(LEGACY_DEFAULT_PASSWORD, existing.password);
  if (stillDefault) {
    if (envPassword) {
      existing.password = envPassword;
      existing.passwordChangedAt = new Date();
      await existing.save();
      await RefreshToken.updateMany({ user: existing._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
      logger.warn('Admin account still used the old default password - replaced with ADMIN_PASSWORD and signed out all sessions.');
    } else if (isProd) {
      throw new Error(
        'The admin account still uses the old published default password. Set ADMIN_PASSWORD (12+ chars) and restart to replace it.'
      );
    } else {
      logger.warn('Admin account still uses the old default password. Set ADMIN_PASSWORD in server/.env to replace it.');
    }
  }

  // Make sure the built-in account can never be locked out or demoted.
  let changed = false;
  if (existing.role !== 'admin') {
    existing.role = 'admin';
    existing.storeId = null;
    changed = true;
  }
  if (existing.banned) {
    existing.banned = false;
    existing.banReason = '';
    changed = true;
  }
  if (existing.deletedAt) {
    existing.deletedAt = null;
    changed = true;
  }
  if (changed) {
    await existing.save();
    logger.info(`Built-in admin restored: ${ADMIN_EMAIL}`);
  }
}

// Data created before this phase has no `status` / `banned` fields stored.
// Fill them in so existing stores stay live and existing users stay active.
async function migrateLegacyData() {
  const stores = await Store.updateMany({ status: { $exists: false } }, { $set: { status: 'approved' } });
  const users = await User.updateMany({ banned: { $exists: false } }, { $set: { banned: false } });

  // `subtotal` became a REQUIRED field when coupons were added. Orders placed
  // before that change have no subtotal/discount/couponCode stored at all.
  // Without this backfill, the very next time code calls .save() on one of
  // these older orders (assigning a rider, leaving a review, a store ban
  // cancelling a pending order, etc.) Mongoose's validator would reject the
  // save with "subtotal is required" - a totally unrelated-looking crash
  // triggered by an old order that predates coupons ever existing. Backfill
  // subtotal = total (no discount applied back then, so that's exactly right)
  // using an aggregation pipeline update so it's one atomic query, not a
  // read-modify-write loop over every legacy order.
  const orders = await Order.updateMany({ subtotal: { $exists: false } }, [
    { $set: { subtotal: '$total', discount: 0, couponCode: '' } },
  ]);

  if (stores.modifiedCount || users.modifiedCount || orders.modifiedCount) {
    logger.info(
      `Migrated legacy data: ${stores.modifiedCount} store(s), ${users.modifiedCount} user(s), ${orders.modifiedCount} order(s)`
    );
  }
}

async function runBootstrap() {
  await migrateLegacyData();
  await ensureBuiltInAdmin();
}

module.exports = { runBootstrap, ensureBuiltInAdmin, ADMIN_EMAIL };
