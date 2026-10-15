// Data-retention job: personal data is only kept as long as it is needed.
//  - Delivery address / phone / notes on finished orders are removed after
//    ORDER_PII_RETENTION_DAYS (the order totals stay, for the store's books).
//  - Old notifications and admin audit-log entries are deleted after their windows.
// Runs once at startup and then daily.
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { RETENTION } = require('./privacy');
const logger = require('./logger');

const DAY_MS = 24 * 60 * 60 * 1000;
const REMOVED_ADDRESS = '[removed after retention period]';
const REMOVED_PHONE = '[removed]';

async function runRetention() {
  const now = Date.now();
  try {
    const orders = await Order.updateMany(
      {
        status: { $in: ['delivered', 'received', 'cancelled'] },
        piiScrubbed: { $ne: true },
        updatedAt: { $lt: new Date(now - RETENTION.orderPersonalDataDays * DAY_MS) },
      },
      { $set: { deliveryAddress: REMOVED_ADDRESS, contactNumber: REMOVED_PHONE, notes: '', piiScrubbed: true } },
      { timestamps: false }
    );
    const notes = await Notification.deleteMany({ createdAt: { $lt: new Date(now - RETENTION.notificationDays * DAY_MS) } });
    const audit = await AuditLog.deleteMany({ createdAt: { $lt: new Date(now - RETENTION.auditLogDays * DAY_MS) } });

    const changed = orders.modifiedCount + notes.deletedCount + audit.deletedCount;
    if (changed) {
      logger.info(
        `Retention: scrubbed ${orders.modifiedCount} order(s), deleted ${notes.deletedCount} notification(s) and ${audit.deletedCount} audit entr(ies)`
      );
    }
  } catch (err) {
    logger.error('Retention job failed:', err);
  }
}

function startRetentionJob() {
  runRetention();
  const timer = setInterval(runRetention, DAY_MS);
  timer.unref(); // never keep the process alive just for this
  return timer;
}

module.exports = { runRetention, startRetentionJob, REMOVED_ADDRESS, REMOVED_PHONE };
