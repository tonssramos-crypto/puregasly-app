const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const {
  register,
  login,
  refresh,
  logout,
  me,
  listSessions,
  revokeSession,
  logoutAll,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

router.get('/sessions', requireAuth, listSessions);
router.delete('/sessions/:id', requireAuth, validateId('id'), revokeSession);
router.post('/logout-all', requireAuth, logoutAll);

module.exports = router;
