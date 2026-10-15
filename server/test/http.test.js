// HTTP-level checks that don't need a database: they exercise security
// middleware, validation order and startup safety checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

process.env.JWT_SECRET = 'j'.repeat(48);
process.env.NODE_ENV = 'test';
const app = require('../server');

let server;
let base;
test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (url, body, headers = {}) =>
  fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('security headers are present and nothing is cacheable', async () => {
  const res = await fetch(base + '/api/health');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('strict-transport-security'), /max-age=31536000/);
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('CORS only allows the configured frontend and enables credentials for it', async () => {
  const ok = await fetch(base + '/api/health', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(ok.headers.get('access-control-allow-credentials'), 'true');
  const bad = await fetch(base + '/api/health', { headers: { Origin: 'https://evil.example.com' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('protected routes reject anonymous requests', async () => {
  for (const url of ['/api/auth/me', '/api/auth/sessions', '/api/auth/export', '/api/orders/mine', '/api/admin/stats']) {
    const res = await fetch(base + url);
    assert.equal(res.status, 401, url);
  }
  assert.equal((await fetch(base + '/api/auth/account', { method: 'DELETE' })).status, 401);
  assert.equal((await post('/api/auth/change-password', {})).status, 401);
});

test('registration validates consent, types and password before touching the database', async () => {
  const good = { name: 'Juan Dela Cruz', email: 'juan@example.com', password: 'Tr1cky-Horse-Battery', role: 'customer', acceptTerms: true };

  let res = await post('/api/auth/register', { ...good, acceptTerms: undefined });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /Privacy Policy/);

  res = await post('/api/auth/register', { ...good, acceptTerms: 'true' });
  assert.equal(res.status, 400, 'consent must be boolean true, not a truthy string');

  res = await post('/api/auth/register', { ...good, password: 'weak1' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /at least 10/);

  res = await post('/api/auth/register', { ...good, name: { $gt: '' } });
  assert.equal(res.status, 400);

  res = await post('/api/auth/register', { ...good, role: 'admin' });
  assert.equal(res.status, 400, 'cannot self-register as admin');
  assert.match((await res.json()).message, /Invalid role/);

  res = await post('/api/auth/register', { ...good, role: 'owner', storeName: 'x' });
  assert.equal(res.status, 400);
});

test('login rejects operator-injection style bodies', async () => {
  let res = await post('/api/auth/login', { email: { $gt: '' }, password: 'whatever12' });
  assert.equal(res.status, 400);
  res = await post('/api/auth/login', { email: 'a@b.co', password: { $ne: null } });
  assert.equal(res.status, 400);
  res = await post('/api/auth/login', { email: 'a'.repeat(300) + '@b.co', password: 'x' });
  assert.equal(res.status, 401);
});

test('refresh/logout cookie endpoints are CSRF-protected and need a cookie', async () => {
  let res = await post('/api/auth/refresh', {}, { Origin: 'https://evil.example.com' });
  assert.equal(res.status, 403);
  res = await post('/api/auth/logout', {}, { Origin: 'https://evil.example.com' });
  assert.equal(res.status, 403);
  res = await post('/api/auth/refresh', {}, { Origin: 'http://localhost:5173' });
  assert.equal(res.status, 401);
  res = await post('/api/auth/refresh', {}, { Cookie: 'pg_rt=garbage' });
  assert.equal(res.status, 401);
});

test('errors never leak internals', async () => {
  let res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { message: 'Invalid request body.' });

  res = await post('/api/auth/login', { email: 'a@b.co', password: 'x'.repeat(20000) });
  assert.equal(res.status, 413);

  res = await fetch(base + '/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { message: 'Not found.' });
});

function boot(env) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
    timeout: 15000,
  });
}

test('production refuses to start with unsafe configuration', () => {
  const base = { NODE_ENV: 'production', JWT_SECRET: 'j'.repeat(48), MONGODB_URI: 'mongodb://127.0.0.1:1/x' };

  let r = boot({ ...base });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /CLIENT_ORIGIN must be set/);

  r = boot({ ...base, CLIENT_ORIGIN: 'https://shop.example.com' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FIELD_ENCRYPTION_KEY must be set/);

  r = boot({ ...base, CLIENT_ORIGIN: 'https://shop.example.com', FIELD_ENCRYPTION_KEY: 'change_this_to_another_long_random_string' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /placeholder/);

  r = boot({ ...base, JWT_SECRET: 'short' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /JWT_SECRET/);
});
