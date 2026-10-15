// Single source of truth for the privacy-policy version users consent to.
// Bump this whenever the policy changes in a way that needs fresh consent;
// everyone whose stored version differs is asked to review and accept again.
const PRIVACY_POLICY_VERSION = '2026-10-15';

// How long personal data is kept (days). Override with env vars.
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const RETENTION = {
  orderPersonalDataDays: num(process.env.ORDER_PII_RETENTION_DAYS, 365),
  notificationDays: num(process.env.NOTIFICATION_RETENTION_DAYS, 90),
  auditLogDays: num(process.env.AUDIT_LOG_RETENTION_DAYS, 730),
};

function consentSummary(user) {
  return {
    accepted: user.consentVersion === PRIVACY_POLICY_VERSION,
    version: user.consentVersion || null,
    acceptedAt: user.consentAcceptedAt || null,
    currentVersion: PRIVACY_POLICY_VERSION,
  };
}

module.exports = { PRIVACY_POLICY_VERSION, RETENTION, consentSummary };
