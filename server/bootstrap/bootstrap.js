const User = require('../models/User');
const Store = require('../models/Store');

// Built-in platform admin. Created automatically on every server start if it
// doesn't exist yet. Override with ADMIN_EMAIL / ADMIN_PASSWORD in .env.
const ADMIN_NAME = 'PureGasly Admin';
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'PGAdmin@pgas.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pg@s365T';

async function ensureBuiltInAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });

  if (!existing) {
    await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });
    console.log(`Built-in admin created: ${ADMIN_EMAIL}`);
    return;
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
  if (changed) {
    await existing.save();
    console.log(`Built-in admin restored: ${ADMIN_EMAIL}`);
  }
}

// Data created before this phase has no `status` / `banned` fields stored.
// Fill them in so existing stores stay live and existing users stay active.
async function migrateLegacyData() {
  const stores = await Store.updateMany({ status: { $exists: false } }, { $set: { status: 'approved' } });
  const users = await User.updateMany({ banned: { $exists: false } }, { $set: { banned: false } });
  if (stores.modifiedCount || users.modifiedCount) {
    console.log(`Migrated legacy data: ${stores.modifiedCount} store(s), ${users.modifiedCount} user(s)`);
  }
}

async function runBootstrap() {
  await migrateLegacyData();
  await ensureBuiltInAdmin();
}

module.exports = { runBootstrap, ensureBuiltInAdmin, ADMIN_EMAIL };
