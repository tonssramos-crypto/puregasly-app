const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireStoreAccess = require('../middleware/storeAccess');
const validateId = require('../middleware/validateId');
const { list, advance, decline } = require('../controllers/storeOrderController');

router.use(requireAuth, requireStoreAccess('manage_orders'));

router.get('/', list);
router.patch('/:id/advance', validateId('id'), advance);
router.patch('/:id/decline', validateId('id'), decline);

module.exports = router;
