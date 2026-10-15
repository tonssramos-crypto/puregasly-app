// Mongoose-level checks that run without a database connection.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'j'.repeat(48);
process.env.FIELD_ENCRYPTION_KEY = 'k'.repeat(40);
const { resetKeyCache } = require('../utils/fieldCrypto');
resetKeyCache();

const Address = require('../models/Address');
const Order = require('../models/Order');
const User = require('../models/User');
const accessGate = require('../utils/accessGate');

test('personal fields are stored encrypted but read back as plaintext', () => {
  const addr = new Address({
    customer: new mongoose.Types.ObjectId(),
    label: 'Home',
    address: '  123 Rizal St, San Fernando  ',
    contactNumber: '0917 123 4567',
  });
  assert.equal(addr.validateSync(), undefined, 'ciphertext must fit the model limits');
  assert.match(addr.toObject().address, /^enc:v1:/);
  assert.match(addr.toObject().contactNumber, /^enc:v1:/);
  assert.equal(addr.address, '123 Rizal St, San Fernando');
  assert.equal(addr.contactNumber, '0917 123 4567');

  // The longest values the controllers allow still fit once encrypted.
  const long = new Address({
    customer: new mongoose.Types.ObjectId(),
    label: 'Work',
    address: 'ñ'.repeat(250),
    contactNumber: '+'.repeat(20),
  });
  assert.equal(long.validateSync(), undefined);
  assert.equal(long.address, 'ñ'.repeat(250));
});

test('orders encrypt address, phone and notes', () => {
  const o = new Order({
    orderNo: 'PG-TEST',
    customer: new mongoose.Types.ObjectId(),
    storeId: new mongoose.Types.ObjectId(),
    items: [{ product: new mongoose.Types.ObjectId(), name: 'LPG', unitPrice: 800, qty: 1 }],
    subtotal: 800,
    total: 800,
    deliveryAddress: '42 Burgos Ave',
    contactNumber: '09171234567',
    notes: 'Leave at gate',
  });
  assert.equal(o.validateSync(), undefined);
  const raw = o.toObject();
  for (const f of ['deliveryAddress', 'contactNumber', 'notes']) assert.match(raw[f], /^enc:v1:/, f);
  assert.equal(o.deliveryAddress, '42 Burgos Ave');
  assert.equal(o.notes, 'Leave at gate');
});

test('old 10-round password hashes are flagged for upgrade, 12-round ones are not', () => {
  const old = new User({ name: 'A B', email: 'a@b.co', password: bcrypt.hashSync('Sup3rsecret-pw', 10) });
  assert.equal(old.needsRehash(), true);
  const current = new User({ name: 'A B', email: 'a@b.co', password: bcrypt.hashSync('Sup3rsecret-pw', 12) });
  assert.equal(current.needsRehash(), false);
  assert.equal(User.BCRYPT_ROUNDS, 12);
});

test('deleted accounts are blocked by the access gate', () => {
  const blocked = accessGate({ deletedAt: new Date(), banned: false, storeId: null, role: 'customer' }, null);
  assert.equal(blocked.code, 'ACCOUNT_DELETED');
  assert.equal(accessGate({ deletedAt: null, banned: false, storeId: null, role: 'customer' }, null), null);
});
