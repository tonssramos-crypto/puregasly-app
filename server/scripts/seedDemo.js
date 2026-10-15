// Run with: node scripts/seedDemo.js  (or npm run seed:demo)
// Creates a ready-to-use Owner account with a store already attached, so you
// can log straight in and test "Manage Employees" without registering
// through the UI first. DEVELOPMENT ONLY - it refuses to run when NODE_ENV=production.
require('dotenv').config();
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const User = require('../models/User');
const Store = require('../models/Store');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to create demo accounts in production.');
  process.exit(1);
}

const crypto = require('crypto');
const DEMO_OWNER_EMAIL = 'demo.owner@puregasly.com';
// Set DEMO_OWNER_PASSWORD in .env to choose one; otherwise a random one is generated and printed once.
const DEMO_OWNER_PASSWORD = process.env.DEMO_OWNER_PASSWORD || crypto.randomBytes(9).toString('base64url') + 'a1';
const DEMO_STORE_NAME = 'Demo LPG Depot';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  let owner = await User.findOne({ email: DEMO_OWNER_EMAIL });

  if (owner) {
    console.log('Demo owner already exists:', DEMO_OWNER_EMAIL);
  } else {
    owner = await User.create({
      name: 'Demo Owner',
      email: DEMO_OWNER_EMAIL,
      password: DEMO_OWNER_PASSWORD,
      role: 'owner',
    });

    const store = await Store.create({ name: DEMO_STORE_NAME, owner: owner._id, status: 'approved' });
    owner.storeId = store._id;
    await owner.save();

    console.log('Demo owner created:');
    console.log('  email:   ', DEMO_OWNER_EMAIL);
    console.log('  password:', DEMO_OWNER_PASSWORD);
    console.log('  store:   ', DEMO_STORE_NAME);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error(err);
  process.exit(1);
});
