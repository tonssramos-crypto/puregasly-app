// Refresh-token cookie helpers (no extra dependency needed).
//
// The refresh token lives in an httpOnly cookie so JavaScript - including any
// injected script (XSS) - can never read it. It is scoped to /api/auth so the
// browser only sends it to the auth endpoints.
const { REFRESH_TOKEN_TTL_MS } = require('./tokens');

const COOKIE_NAME = 'pg_rt';

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  // The Render blueprint serves the API and the website from different
  // subdomains, which browsers treat as cross-site - so production needs
  // SameSite=None (which in turn requires Secure). Override with COOKIE_SAMESITE
  // (lax | strict | none) if both are served from one domain.
  const allowed = ['lax', 'strict', 'none'];
  const requested = String(process.env.COOKIE_SAMESITE || '').toLowerCase();
  const sameSite = allowed.includes(requested) ? requested : isProd ? 'none' : 'lax';
  return {
    httpOnly: true,
    secure: isProd || sameSite === 'none',
    sameSite,
    path: '/api/auth',
  };
}

function setRefreshCookie(res, rawToken) {
  res.cookie(COOKIE_NAME, rawToken, { ...cookieOptions(), maxAge: REFRESH_TOKEN_TTL_MS });
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function getRefreshToken(req) {
  const value = parseCookies(req.headers.cookie)[COOKIE_NAME];
  return typeof value === 'string' && /^[a-f0-9]{96}$/.test(value) ? value : null;
}

module.exports = { COOKIE_NAME, parseCookies, setRefreshCookie, clearRefreshCookie, getRefreshToken, cookieOptions };
