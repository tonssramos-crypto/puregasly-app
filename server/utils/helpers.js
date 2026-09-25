const mongoose = require('mongoose');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidId(id) {
  return mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

// Philippine time (UTC+8, no DST). Used so "today" on analytics matches the store's day.
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
function dayKey(date) {
  return new Date(new Date(date).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { escapeRegex, isValidId, dayKey, round2, TZ_OFFSET_MS };
