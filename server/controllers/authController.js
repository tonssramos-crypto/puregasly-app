const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Store = require('../models/Store');
const Order = require('../models/Order');
const Address = require('../models/Address');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const RefreshToken = require('../models/RefreshToken');
const accessGate = require('../utils/accessGate');
const { isLocked, lockMessage, registerFailure, registerSuccess } = require('../utils/accountLock');
const { signAccessToken, createRefreshTokenPair, hashToken, newFamilyId, REUSE_GRACE_MS } = require('../utils/tokens');
const { isValidName, hasValidMailDomain, EMAIL_REGEX, validatePassword } = require('../utils/validation');
const { setRefreshCookie, clearRefreshCookie, getRefreshToken } = require('../utils/cookies');
const { PRIVACY_POLICY_VERSION, consentSummary } = require('../utils/privacy');
const { notify } = require('../utils/notify');
const { REMOVED_ADDRESS, REMOVED_PHONE } = require('../utils/retention');
const logger = require('../utils/logger');

// Compared against when the e-mail doesn't exist, so a login for an unknown
// account takes as long as one for a real account (no timing side-channel).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const ACTIVE_ORDER_STATUSES = ['pending', 'preparing', 'out_for_delivery', 'delivered'];

function toSafeUser(user) {
  const s = user.storeId && user.storeId.name ? user.storeId : null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    consent: consentSummary(user),
    store: s
      ? {
          id: s._id,
          name: s.name,
          status: s.status,
          banReason: s.banReason,
          rejectionReason: s.rejectionReason,
          address: s.address,
          phone: s.phone,
          description: s.description,
          appeal: s.appeal
            ? {
                status: s.appeal.status,
                message: s.appeal.message,
                submittedAt: s.appeal.submittedAt,
                adminNote: s.appeal.adminNote,
              }
            : { status: 'none' },
        }
      : null,
  };
}

// Issues a fresh access token and a refresh token. The refresh token is hashed
// before it is stored; the raw value only ever leaves the server inside an
// httpOnly cookie (set by the caller via setRefreshCookie).
async function issueTokens(userId, userAgent, family = newFamilyId()) {
  const accessToken = signAccessToken(userId);
  const { raw, tokenHash, expiresAt } = createRefreshTokenPair();
  await RefreshToken.create({
    user: userId,
    tokenHash,
    expiresAt,
    family,
    userAgent: String(userAgent || '').slice(0, 300),
  });
  return { accessToken, refreshToken: raw };
}

async function revokeAllSessions(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, storeName, acceptTerms } = req.body;

    if (![name, email, password, role].every((v) => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Consent has to be an explicit, affirmative act - never pre-ticked or implied.
    if (acceptTerms !== true) {
      return res.status(400).json({ message: 'You must accept the Privacy Policy to create an account.' });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidName(trimmedName)) {
      return res.status(400).json({ message: 'Please enter your full name (first and last, letters only).' });
    }

    if (normalizedEmail.length > 254 || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const passwordError = validatePassword(password, { email: normalizedEmail, name: trimmedName });
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    if (!['customer', 'owner'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role for self-registration.' });
    }

    if (role === 'owner') {
      const sn = typeof storeName === 'string' ? storeName.trim() : '';
      if (sn.length < 2 || sn.length > 80) {
        return res.status(400).json({ message: 'Store name is required for store owners (2-80 characters).' });
      }
    }

    // DNS lookup is the slowest check, so it runs after the cheap ones.
    if (!(await hasValidMailDomain(normalizedEmail))) {
      return res.status(400).json({ message: "We couldn't verify that email's domain. Please check for typos." });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    let user;
    try {
      user = await User.create({
        name: trimmedName,
        email: normalizedEmail,
        password,
        role,
        consentVersion: PRIVACY_POLICY_VERSION,
        consentAcceptedAt: new Date(),
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
      throw err;
    }

    if (role === 'owner') {
      // New stores wait for admin approval before the owner can log in.
      const store = await Store.create({
        name: storeName.trim(),
        owner: user._id,
        status: 'pending',
      });
      user.storeId = store._id;
      await user.save();

      return res.status(201).json({
        message: 'Application submitted. An admin needs to approve your store before you can log in.',
        pendingApproval: true,
      });
    }

    return res.status(201).json({ message: 'Account created successfully.' });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    // Anything longer can never be a valid password; don't spend bcrypt time on it.
    if (email.length > 254 || password.length > 1024) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail })
      .select('+password')
      .populate('storeId');

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH); // equalise response time
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (isLocked(user)) {
      return res.status(423).json({ code: 'ACCOUNT_LOCKED', message: lockMessage(user) });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      const justLocked = await registerFailure(user);
      if (justLocked) {
        logger.security('account_locked', { userId: String(user._id) });
        return res.status(423).json({ code: 'ACCOUNT_LOCKED', message: lockMessage(user) });
      }
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Only reveal ban / approval status once the password was correct.
    const blocked = accessGate(user, user.storeId);
    if (blocked) {
      return res.status(403).json(blocked);
    }

    // Quietly upgrade old, weaker hashes now that we briefly hold the plaintext.
    if (user.needsRehash()) {
      user.password = password;
      await user.save();
    }
    await registerSuccess(user);

    // Sign-in from a device we have never seen for this account -> tell the user.
    const ua = String(req.headers['user-agent'] || '').slice(0, 300);
    const [hadSessions, knownDevice] = await Promise.all([
      RefreshToken.exists({ user: user._id }),
      RefreshToken.exists({ user: user._id, userAgent: ua }),
    ]);
    if (hadSessions && !knownDevice) {
      notify(user._id, {
        type: 'security_alert',
        title: 'New sign-in to your account',
        message: 'We noticed a sign-in from a device we have not seen before. If this was not you, change your password and log out other devices.',
        link: '/security',
      });
    }

    const { accessToken, refreshToken } = await issueTokens(user._id, ua);
    setRefreshCookie(res, refreshToken);

    return res.json({
      message: 'Login successful.',
      token: accessToken,
      user: toSafeUser(user),
    });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/refresh   - reads the httpOnly refresh cookie (no body needed)
exports.refresh = async (req, res) => {
  try {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    const stored = await RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
    if (!stored) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    if (stored.revokedAt) {
      // A token that was already rotated is being used again. Inside the short
      // grace window that's just two tabs racing; outside it, the token was
      // most likely stolen - kill every session descended from the same login.
      if (stored.rotatedAt && Date.now() - stored.rotatedAt.getTime() > REUSE_GRACE_MS) {
        await RefreshToken.updateMany(
          { user: stored.user, family: stored.family || String(stored._id), revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
        logger.security('refresh_token_reuse', { userId: String(stored.user), family: stored.family });
      }
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    if (stored.expiresAt < new Date()) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    const user = await User.findById(stored.user).populate('storeId');
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    // Re-check ban / store status on every refresh so a mid-session ban takes effect.
    const blocked = accessGate(user, user.storeId);
    if (blocked) {
      await RefreshToken.updateOne({ _id: stored._id }, { $set: { revokedAt: new Date() } });
      clearRefreshCookie(res);
      return res.status(403).json(blocked);
    }

    // Rotate: this token is single-use. The conditional update makes the swap
    // atomic - if a parallel request already used it, we lose the race and stop.
    const now = new Date();
    const claimed = await RefreshToken.findOneAndUpdate(
      { _id: stored._id, revokedAt: null },
      { $set: { revokedAt: now, rotatedAt: now } }
    );
    if (!claimed) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    const family = stored.family || String(stored._id);
    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(
      user._id,
      req.headers['user-agent'],
      family
    );
    setRefreshCookie(res, newRefreshToken);

    return res.json({ token: accessToken, user: toSafeUser(user) });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/auth/logout   - revokes just this session (cookie identifies it)
exports.logout = async (req, res) => {
  try {
    const refreshToken = getRefreshToken(req);
    if (refreshToken) {
      await RefreshToken.updateOne(
        { tokenHash: hashToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    clearRefreshCookie(res);
    return res.json({ message: 'Logged out.' });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('storeId');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json(toSafeUser(user));
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/auth/sessions   - this user's active (non-revoked, unexpired) sessions
exports.listSessions = async (req, res) => {
  try {
    const current = getRefreshToken(req);
    const currentHash = current ? hashToken(current) : null;

    const sessions = await RefreshToken.find({
      user: req.userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return res.json(
      sessions.map((s) => ({
        id: s._id,
        userAgent: s.userAgent || 'Unknown device',
        createdAt: s.createdAt,
        current: currentHash === s.tokenHash,
      }))
    );
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/auth/sessions/:id   - revoke one session (log that device out)
exports.revokeSession = async (req, res) => {
  try {
    const session = await RefreshToken.findOneAndUpdate(
      { _id: req.params.id, user: req.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    if (!session) return res.status(404).json({ message: 'Session not found.' });
    return res.json({ message: 'Session logged out.' });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/auth/logout-all   - revoke every refresh token for this user
exports.logoutAll = async (req, res) => {
  try {
    await revokeAllSessions(req.userId);
    clearRefreshCookie(res);
    return res.json({ message: 'Logged out of all devices.' });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/auth/change-password   body: { currentPassword, newPassword }
// Verifies the current password, then signs out every OTHER device and keeps
// this one signed in with a fresh session.
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (isLocked(user)) {
      return res.status(423).json({ code: 'ACCOUNT_LOCKED', message: lockMessage(user) });
    }

    // A wrong "current password" counts toward the lockout, so a stolen access
    // token can't be used to guess the password.
    if (!(await user.comparePassword(currentPassword))) {
      const justLocked = await registerFailure(user);
      if (justLocked) return res.status(423).json({ code: 'ACCOUNT_LOCKED', message: lockMessage(user) });
      return res.status(400).json({ message: 'Your current password is incorrect.' });
    }

    const passwordError = validatePassword(newPassword, { email: user.email, name: user.name });
    if (passwordError) return res.status(400).json({ message: passwordError });
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'Your new password must be different from the current one.' });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await revokeAllSessions(user._id);
    const { accessToken, refreshToken } = await issueTokens(user._id, req.headers['user-agent']);
    setRefreshCookie(res, refreshToken);

    notify(user._id, {
      type: 'security_alert',
      title: 'Your password was changed',
      message: 'All other devices were signed out. If this was not you, contact support right away.',
      link: '/security',
    });

    return res.json({ message: 'Password updated. Other devices were signed out.', token: accessToken });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/auth/consent   body: { accept: true }
// Records that the signed-in user has accepted the CURRENT privacy policy
// (for accounts created before consent was captured, staff accounts created by
// an owner, and whenever the policy version changes).
exports.acceptConsent = async (req, res) => {
  try {
    if (req.body.accept !== true) {
      return res.status(400).json({ message: 'Consent must be given explicitly.' });
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { consentVersion: PRIVACY_POLICY_VERSION, consentAcceptedAt: new Date() } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ consent: consentSummary(user) });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/auth/export   - everything we hold about the signed-in user (data portability / right of access)
exports.exportData = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const [addresses, orders, favorites, reviews, notifications, sessions] = await Promise.all([
      Address.find({ customer: user._id }).sort({ createdAt: -1 }),
      Order.find({ customer: user._id }).populate('storeId', 'name').sort({ createdAt: -1 }),
      Favorite.find({ customer: user._id }),
      Review.find({ customer: user._id }),
      Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(500),
      RefreshToken.find({ user: user._id, revokedAt: null, expiresAt: { $gt: new Date() } }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        consent: consentSummary(user),
      },
      addresses: addresses.map((a) => ({
        label: a.label,
        address: a.address,
        contactNumber: a.contactNumber,
        isDefault: a.isDefault,
        createdAt: a.createdAt,
      })),
      orders: orders.map((o) => ({
        orderNo: o.orderNo,
        store: o.storeId && o.storeId.name ? o.storeId.name : '',
        items: o.items,
        subtotal: o.subtotal,
        discount: o.discount,
        couponCode: o.couponCode,
        total: o.total,
        status: o.status,
        deliveryAddress: o.deliveryAddress,
        contactNumber: o.contactNumber,
        notes: o.notes,
        placedAt: o.createdAt,
      })),
      favorites: favorites.map((f) => ({ type: f.targetType, id: f.targetId, savedAt: f.createdAt })),
      reviews: reviews.map((r) => ({ rating: r.rating, comment: r.comment, createdAt: r.createdAt })),
      notifications: notifications.map((n) => ({ title: n.title, message: n.message, at: n.createdAt })),
      activeSessions: sessions.map((s) => ({ device: s.userAgent, signedInAt: s.createdAt })),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="puregasly-my-data.json"');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/auth/account   body: { password }   (customers)
// Erases the person's data and anonymises the account row. The row itself is
// kept so references from orders/reviews don't break, but nothing in it
// identifies the person any more, and nobody can sign in to it.
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Please enter your password to confirm.' });
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.role !== 'customer') {
      return res.status(403).json({
        message:
          user.role === 'admin'
            ? 'The platform admin account cannot be deleted here.'
            : 'Staff, rider and store-owner accounts are managed by the store owner or an admin. Please contact them to remove this account.',
      });
    }

    if (isLocked(user)) {
      return res.status(423).json({ code: 'ACCOUNT_LOCKED', message: lockMessage(user) });
    }
    if (!(await user.comparePassword(password))) {
      const justLocked = await registerFailure(user);
      if (justLocked) return res.status(423).json({ code: 'ACCOUNT_LOCKED', message: lockMessage(user) });
      return res.status(400).json({ message: 'Incorrect password.' });
    }

    const active = await Order.countDocuments({ customer: user._id, status: { $in: ACTIVE_ORDER_STATUSES } });
    if (active > 0) {
      return res.status(409).json({
        message: 'You still have an order in progress. Please wait until it is completed (or cancel it) before deleting your account.',
      });
    }

    // Remove personal data held elsewhere.
    await Promise.all([
      Address.deleteMany({ customer: user._id }),
      Favorite.deleteMany({ customer: user._id }),
      Notification.deleteMany({ user: user._id }),
      RefreshToken.deleteMany({ user: user._id }),
      Review.updateMany({ customer: user._id }, { $set: { comment: '' } }),
      // Order totals stay (the store's books need them); who/where does not.
      Order.updateMany(
        { customer: user._id },
        { $set: { deliveryAddress: REMOVED_ADDRESS, contactNumber: REMOVED_PHONE, notes: '', piiScrubbed: true } },
        { timestamps: false }
      ),
    ]);

    // Anonymise the account itself.
    user.name = 'Deleted User';
    user.email = `deleted-${user._id}@deleted.invalid`;
    user.password = crypto.randomBytes(32).toString('hex'); // unusable; hashed by the pre-save hook
    user.deletedAt = new Date();
    user.consentVersion = '';
    user.consentAcceptedAt = null;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.passwordChangedAt = new Date();
    await user.save();

    clearRefreshCookie(res);
    logger.security('account_deleted', { userId: String(user._id) });
    return res.json({ message: 'Your account and personal data have been deleted.' });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
