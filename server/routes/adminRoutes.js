const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const validateId = require('../middleware/validateId');
const c = require('../controllers/adminController');

router.use(requireAuth, requireRole('admin'));

router.get('/stats', c.stats);

router.get('/stores', c.listStores);
router.patch('/stores/:id/approve', validateId('id'), c.approveStore);
router.patch('/stores/:id/reject', validateId('id'), c.rejectStore);
router.patch('/stores/:id/ban', validateId('id'), c.banStore);
router.patch('/stores/:id/unban', validateId('id'), c.unbanStore);
router.patch('/stores/:id/appeal', validateId('id'), c.resolveAppeal);

router.get('/users', c.listUsers);
router.patch('/users/:id/ban', validateId('id'), c.banUser);
router.patch('/users/:id/unban', validateId('id'), c.unbanUser);

module.exports = router;
