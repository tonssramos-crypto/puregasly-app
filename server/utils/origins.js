// Which browser origins may talk to this API.
// CLIENT_ORIGIN = comma-separated list (e.g. https://puregasly-web.onrender.com).
// In production an empty list means "no cross-origin access" (fail closed);
// in development the usual Vite origins are allowed automatically.
function allowedOrigins() {
  const fromEnv = String(process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (process.env.NODE_ENV === 'production') return fromEnv;
  return [...new Set([...fromEnv, 'http://localhost:5173', 'http://127.0.0.1:5173'])];
}

function isAllowedOrigin(origin) {
  return allowedOrigins().includes(String(origin || '').replace(/\/+$/, ''));
}

// CSRF defence for the endpoints that act on the refresh cookie. Browsers
// always attach an Origin header to cross-site POSTs, so a request that
// carries an untrusted Origin is rejected. (Requests with no Origin header at
// all cannot come from a cross-site browser page.)
function requireTrustedOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next();
  let sameHost = false;
  try {
    sameHost = new URL(origin).host === req.headers.host;
  } catch {
    // malformed Origin - falls through to the rejection below
  }
  if (sameHost || isAllowedOrigin(origin)) return next();
  return res.status(403).json({ message: 'Request blocked.' });
}

module.exports = { allowedOrigins, isAllowedOrigin, requireTrustedOrigin };
