// Small logger that never prints request bodies or the raw error object.
// Raw Mongoose/Mongo errors can embed user data (a duplicate-key error
// contains the e-mail address that clashed, a validation error contains the
// rejected value), so we only log the error's name, message and code - and the
// stack trace outside production.
const isProd = process.env.NODE_ENV === 'production';

function describe(err) {
  if (!(err instanceof Error)) return String(err);
  if (err.code === 11000) return `${err.name}: duplicate key (details withheld)`;
  const base = `${err.name}: ${err.message}`;
  return !isProd && err.stack ? err.stack : base;
}

function stamp(level) {
  return `[${new Date().toISOString()}] ${level}`;
}

exports.error = (...args) => console.error(stamp('ERROR'), ...args.map((a) => (a instanceof Error ? describe(a) : a)));
exports.warn = (...args) => console.warn(stamp('WARN'), ...args);
exports.info = (...args) => console.log(stamp('INFO'), ...args);
// Security-relevant events (reuse of a revoked token, new-device sign-in...).
exports.security = (event, details = {}) => console.warn(stamp('SECURITY'), event, JSON.stringify(details));
