const dns = require('dns').promises;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Letters (incl. accented/Unicode), spaces, hyphens, apostrophes, periods.
// Requires at least two "words" (a first and last name) since the field is
// labeled Full Name, and each word must have at least 2 letters - this is
// what actually rejects junk like "ab" or "11" that the plain length check
// let through before.
const NAME_REGEX = /^[\p{L}][\p{L}'.-]?[\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]?[\p{L}'.-]*)+$/u;

function isValidName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (name.length < 4 || name.length > 80) return false;
  return NAME_REGEX.test(name);
}

// Checks the email's domain actually has mail-capable DNS records (MX, or
// failing that A/AAAA, since some small domains route mail without a
// dedicated MX record). This catches typo'd/nonexistent domains
// (e.g. "user@gnail.con") without needing a paid verification API or
// sending an actual confirmation email (no email service is configured
// yet) - it does NOT confirm the mailbox itself exists, only that the
// domain could plausibly receive mail.
async function hasValidMailDomain(email) {
  const domain = String(email || '').split('@')[1];
  if (!domain) return false;

  const withTimeout = (promise) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('dns timeout')), 3000))]);

  try {
    const mx = await withTimeout(dns.resolveMx(domain));
    if (mx && mx.length > 0) return true;
  } catch {
    // no MX records (or lookup failed) - fall through and try A/AAAA below
  }

  try {
    const a = await withTimeout(dns.resolve(domain));
    return !!(a && a.length > 0);
  } catch {
    try {
      const aaaa = await withTimeout(dns.resolve6(domain));
      return !!(aaaa && aaaa.length > 0);
    } catch {
      return false;
    }
  }
}

// ---------- passwords ----------
// bcrypt only uses the first 72 BYTES of a password and silently ignores the
// rest, so anything longer would give a false sense of security - cap it.
const PASSWORD_MIN = 10;
const PASSWORD_MAX_BYTES = 72;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd123',
  'qwerty123', 'qwerty1234', 'qwertyuiop1', '1234567890', '12345678910', '123456789a',
  'abc1234567', 'abcd123456', 'iloveyou123', 'welcome123', 'welcome1234', 'admin12345',
  'letmein123', 'monkey1234', 'dragon1234', 'sunshine123', 'princess123', 'football123',
  'pureglasly1', 'puregasly123', 'puregasly1', 'lpgdepot123', 'changeme123', 'pg@s365t',
]);

// Returns an error message, or null when the password is acceptable.
// `context` ({ email, name }) lets us reject passwords built from the user's own details.
function validatePassword(password, context = {}) {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `Password is too long (max ${PASSWORD_MAX_BYTES} bytes).`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'That password is too common. Please choose a less predictable one.';
  if (/^(.)\1+$/.test(password)) return 'Password cannot be a single repeated character.';

  const local = String(context.email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return 'Password must not contain your email address.';
  return null;
}

module.exports = { isValidName, hasValidMailDomain, EMAIL_REGEX, validatePassword, PASSWORD_MIN, PASSWORD_MAX_BYTES };
