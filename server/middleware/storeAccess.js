const User = require('../models/User');
const Store = require('../models/Store');

/**
 * Grants access if the logged-in user is the Owner of an APPROVED store
 * (owners implicitly have every permission on their own store - see
 * User.hasPermission), or an Employee whose owner has granted them the given
 * permission.
 *
 * Usage: router.use(requireAuth, requireStoreAccess('manage_inventory'))
 */
function requireStoreAccess(permission) {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized.' });
      }

      if (!user.storeId || !['owner', 'employee'].includes(user.role)) {
        return res.status(403).json({ message: 'No store is associated with this account.' });
      }

      const store = await Store.findById(user.storeId);
      if (!store || store.status !== 'approved') {
        return res.status(403).json({
          code: 'STORE_NOT_ACTIVE',
          message: 'Your store is not active right now.',
        });
      }

      if (!user.hasPermission(permission)) {
        return res.status(403).json({ message: 'You do not have permission to do that.' });
      }

      req.currentUser = user;
      req.currentStore = store;
      next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Something went wrong.' });
    }
  };
}

module.exports = requireStoreAccess;
