// Field-level encryption for personal data stored in MongoDB (delivery
// addresses, phone numbers). AES-256-GCM, random 96-bit IV per value.
//
// Stored format:  enc:v1:<iv>.<authTag>.<ciphertext>   (base64 parts)
//
// - FIELD_ENCRYPTION_KEY can be any secret string of 32+ chars; the actual
//   256-bit key is derived from it with SHA-256.
// - Values that don't start with the prefix are treated as legacy plaintext
//   and returned as-is, so existing data keeps working and is encrypted the
//   next time the document is saved.
// - Without a key (development only - production refuses to boot without one)
//   values are stored in plaintext.
// - IMPORTANT: losing the key means losing the encrypted values. Back it up.
const crypto = require('crypto');

const PREFIX = 'enc:v1:';
let cachedKey;

function getKey() {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  cachedKey = raw ? crypto.createHash('sha256').update(String(raw)).digest() : null;
  return cachedKey;
}

// Test helper - lets unit tests change the env var between cases.
function resetKeyCache() {
  cachedKey = undefined;
}

function encryptField(value) {
  if (value === null || value === undefined || value === '') return value;
  const text = typeof value === 'string' ? value.trim() : String(value);
  const key = getKey();
  if (!key || text.startsWith(PREFIX)) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

function decryptField(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) return '[unavailable]';
  try {
    const [iv, tag, enc] = value.slice(PREFIX.length).split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '[unavailable]';
  }
}

// Mongoose schema options: { type: String, ...encryptedField }
const encryptedField = { set: encryptField, get: decryptField };

module.exports = { encryptField, decryptField, encryptedField, resetKeyCache, PREFIX };
