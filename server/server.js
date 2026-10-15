require('dotenv').config();
const logger = require('./utils/logger');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { runBootstrap } = require('./bootstrap/bootstrap');
const { allowedOrigins, isAllowedOrigin } = require('./utils/origins');
const { startRetentionJob } = require('./utils/retention');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const adminRoutes = require('./routes/adminRoutes');
const shopRoutes = require('./routes/shopRoutes');
const orderRoutes = require('./routes/orderRoutes');
const storeOrderRoutes = require('./routes/storeOrderRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const storeRoutes = require('./routes/storeRoutes');
const riderRoutes = require('./routes/riderRoutes');
const riderOrderRoutes = require('./routes/riderOrderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const addressRoutes = require('./routes/addressRoutes');
const couponRoutes = require('./routes/couponRoutes');

const isProd = process.env.NODE_ENV === 'production';

// ---------- fail fast on unsafe configuration ----------
function fatalConfig(message) {
  console.error(`Configuration error: ${message}`);
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  fatalConfig('JWT_SECRET is missing or too short (need 32+ characters). Set a long random string in server/.env');
}
if (isProd) {
  if (/^change_this/i.test(process.env.JWT_SECRET) || /^change_this/i.test(process.env.FIELD_ENCRYPTION_KEY || '')) {
    fatalConfig('JWT_SECRET / FIELD_ENCRYPTION_KEY still contain the placeholder text from .env.example. Generate real random values.');
  }
  if (!allowedOrigins().length) {
    fatalConfig('CLIENT_ORIGIN must be set in production (the URL of your website, e.g. https://puregasly-web.onrender.com).');
  }
  if (!process.env.FIELD_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY.length < 32) {
    fatalConfig('FIELD_ENCRYPTION_KEY must be set in production (32+ random characters). It encrypts delivery addresses and phone numbers.');
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Render (and most hosts) put a proxy in front of the app. Without this every
// visitor looks like the same IP to the rate limiter.
// Number of proxies in front of the app (Render = 1). Raise it only if you add another proxy layer.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

// Express sends an ETag on every JSON response by default. A browser that
// still has an old ETag for the same URL can send it back and get a 304
// (not modified) instead of the fresh data a POST/PATCH/DELETE just wrote -
// which looks exactly like "my change didn't show up until I refresh or
// navigate away and back". Disabling it, plus explicitly marking every API
// response as never cacheable below, removes the possibility entirely.
app.set('etag', false);

// ---------- security middleware ----------
// Production traffic must arrive over HTTPS (the proxy tells us via
// X-Forwarded-Proto). The health check is exempt so the host can probe it.
if (isProd) {
  app.use((req, res, next) => {
    if (req.secure || req.path === '/api/health') return next();
    return res.status(400).json({ message: 'HTTPS is required.' });
  });
}

app.use(
  helmet({
    // Tell browsers to only ever use HTTPS for this host for the next year.
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Only the configured frontend origin(s) may call the API from a browser, and
// only they may send the refresh cookie (credentials). With no CLIENT_ORIGIN in
// production the list is empty, i.e. cross-origin access is denied.
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    maxAge: 600,
  })
);
app.use(express.json({ limit: '10kb' }));
// Strips any $ or . keys from req.body/query/params so user input can't be
// crafted into a MongoDB operator (NoSQL injection).
app.use(mongoSanitize());

const limiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, message: { message }, standardHeaders: true, legacyHeaders: false });

// Login/register are brute-force targets, so they get a tighter limit than
// the rest of the API.
const authLimiter = limiter(15 * 60 * 1000, 20, 'Too many attempts. Please try again in a few minutes.');
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// Endpoints that verify a password (or hand out a lot of data) get their own budget.
const sensitiveLimiter = limiter(60 * 60 * 1000, 10, 'Too many attempts. Please try again later.');
app.use('/api/auth/change-password', sensitiveLimiter);
app.use('/api/auth/account', sensitiveLimiter);
app.use('/api/auth/export', sensitiveLimiter);
app.use('/api/auth/refresh', limiter(15 * 60 * 1000, 120, 'Too many requests. Please slow down.'));

// General ceiling for everything else so one client can't hammer the API.
app.use('/api', limiter(5 * 60 * 1000, 600, 'Too many requests. Please slow down.'));

// ---------- routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/store-orders', storeOrderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/rider-orders', riderOrderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/coupons', couponRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

// Malformed JSON etc. - never leak stack traces to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large.' });
  logger.error(err);
  return res.status(500).json({ message: 'Something went wrong.' });
});

// Last-resort handlers: log (without personal data) instead of dying silently.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception - shutting down:', err);
  process.exit(1);
});

// Only start listening when run directly (`node server.js`); tests import `app`.
if (require.main === module) {
  connectDB()
    .then(runBootstrap)
    .then(() => {
      startRetentionJob();
      app.listen(PORT, '0.0.0.0', () => {
        logger.info(`PureGasly API running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      logger.error('Startup failed:', err);
      process.exit(1);
    });
}

module.exports = app;
