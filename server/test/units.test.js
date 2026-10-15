// Unit tests for the pure security helpers (no database needed).
// Run with:  npm test
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'x'.repeat(40);

const { validatePassword } = require('../utils/validation');
const crypto2 = require('../utils/fieldCrypto');
const { parseCookies, getRefreshToken, cookieOptions } = require('../utils/cookies');
const { allowedOrigins, isAllowedOrigin, requireTrustedOrigin } = require('../utils/origins');
const { createRefreshTokenPair, hashToken } = require('../utils/tokens');

test('password policy rejects weak and accepts strong passwords', () => {
  assert.match(validatePassword('short1'), /at least 10/);
  assert.match(validatePassword('onlyletterspassword'), /letter and one number/);
  assert.match(validatePassword('12345678901'), /letter and one number/);
  assert.match(validatePassword('Password123'), /too common/);
  assert.match(validatePassword('a'.repeat(80) + '1'), /too long/);
  assert.match(validatePassword('juandelacruz99', { email: 'juandelacruz@example.com' }), /email/);
  assert.match(validatePassword(undefined), /required/);
  assert.match(validatePassword({ $ne: '' }), /required/);
  assert.equal(validatePassword('Tr1cky-Horse-Battery'), null);
});

test('field encryption round-trips, uses random IVs and detects tampering', () => {
  process.env.FIELD_ENCRYPTION_KEY = 'k'.repeat(40);
  crypto2.resetKeyCache();
  const a = crypto2.encryptField('  123 Rizal St, San Fernando  ');
  const b = crypto2.encryptField('123 Rizal St, San Fernando');
  assert.ok(a.startsWith(crypto2.PREFIX));
  assert.notEqual(a, b, 'same plaintext must give different ciphertext');
  assert.equal(crypto2.decryptField(a), '123 Rizal St, San Fernando');
  assert.equal(crypto2.encryptField(a), a, 'already-encrypted values are not double-encrypted');
  const parts = a.split('.');
  parts[2] = Buffer.from('tampered').toString('base64');
  assert.equal(crypto2.decryptField(parts.join('.')), '[unavailable]');
  assert.equal(crypto2.decryptField('legacy plaintext'), 'legacy plaintext');
  assert.equal(crypto2.encryptField(''), '');

  process.env.FIELD_ENCRYPTION_KEY = 'z'.repeat(40);
  crypto2.resetKeyCache();
  assert.equal(crypto2.decryptField(a), '[unavailable]', 'wrong key cannot decrypt');

  delete process.env.FIELD_ENCRYPTION_KEY;
  crypto2.resetKeyCache();
  assert.equal(crypto2.encryptField('plain'), 'plain', 'no key (dev) stores plaintext');
});

test('cookie parsing only accepts a well-formed refresh token', () => {
  const { raw } = createRefreshTokenPair();
  assert.equal(raw.length, 96);
  assert.equal(parseCookies('a=1; pg_rt=' + raw + '; b=2').pg_rt, raw);
  assert.equal(getRefreshToken({ headers: { cookie: 'pg_rt=' + raw } }), raw);
  assert.equal(getRefreshToken({ headers: { cookie: 'pg_rt=not-a-token' } }), null);
  assert.equal(getRefreshToken({ headers: {} }), null);
  assert.notEqual(hashToken(raw), raw);
});

test('refresh cookie is httpOnly and Secure/SameSite=None in production', () => {
  const prev = process.env.NODE_ENV;
  delete process.env.COOKIE_SAMESITE;
  process.env.NODE_ENV = 'production';
  assert.deepEqual(cookieOptions(), { httpOnly: true, secure: true, sameSite: 'none', path: '/api/auth' });
  process.env.NODE_ENV = 'development';
  assert.equal(cookieOptions().sameSite, 'lax');
  assert.equal(cookieOptions().httpOnly, true);
  process.env.NODE_ENV = prev;
});

test('origin allow-list fails closed in production', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.CLIENT_ORIGIN;
  assert.deepEqual(allowedOrigins(), []);
  process.env.CLIENT_ORIGIN = 'https://shop.example.com/, https://b.example.com';
  assert.ok(isAllowedOrigin('https://shop.example.com'));
  assert.ok(!isAllowedOrigin('https://evil.example.com'));
  process.env.NODE_ENV = 'development';
  delete process.env.CLIENT_ORIGIN;
  assert.ok(isAllowedOrigin('http://localhost:5173'));
  process.env.NODE_ENV = prev;
});

test('requireTrustedOrigin blocks cross-site cookie requests', () => {
  process.env.CLIENT_ORIGIN = 'https://shop.example.com';
  const run = (origin, host = 'api.example.com') => {
    let status = 200;
    let nextCalled = false;
    const res = { status(c) { status = c; return this; }, json() {} };
    requireTrustedOrigin({ headers: { origin, host } }, res, () => { nextCalled = true; });
    return { status, nextCalled };
  };
  assert.equal(run('https://shop.example.com').nextCalled, true);
  assert.equal(run('https://api.example.com').nextCalled, true, 'same host is fine');
  assert.equal(run(undefined).nextCalled, true, 'no Origin header cannot be a cross-site browser request');
  assert.deepEqual(run('https://evil.example.com'), { status: 403, nextCalled: false });
  assert.deepEqual(run('not a url'), { status: 403, nextCalled: false });
});
