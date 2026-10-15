const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const { requireTrustedOrigin } = require('../utils/origins');
const {
  register,
  login,
  refresh,
  logout,
  me,
  listSessions,
  revokeSession,
  logoutAll,
  changePassword,
  acceptConsent,
  exportData,
  deleteAccount,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);

// These two act on the httpOnly refresh cookie, so they also verify the
// request's Origin (CSRF protection).
router.post('/refresh', requireTrustedOrigin, refresh);
router.post('/logout', requireTrustedOrigin, logout);

router.get('/me', requireAuth, me);

router.get('/sessions', requireAuth, listSessions);
router.delete('/sessions/:id', requireAuth, validateId('id'), revokeSession);
router.post('/logout-all', requireAuth, logoutAll);

router.post('/change-password', requireAuth, changePassword);

// Privacy: consent, right of access (export) and right to erasure.
router.post('/consent', requireAuth, acceptConsent);
router.get('/export', requireAuth, exportData);
router.delete('/account', requireAuth, deleteAccount);

module.exports = router;
