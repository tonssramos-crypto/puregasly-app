# PureGasly — Security Upgrade Progress

This file tracks progress on feature batches so work can resume cleanly
across sessions. It is updated as work happens, not just at the end — check
here first before assuming something is missing.

## Batch: Security (account lockout, refresh tokens/sessions, admin audit log)
## Status: ✅ DONE

Email-based features (password reset, email verification) were explicitly
skipped this batch — no email service configured yet. Revisit if/when one is
added.

### Backend
- `models/User.js` — `failedLoginAttempts`, `lockUntil`
- `utils/accountLock.js` — 5 failed attempts → 15 min lock; clears on success
  or admin unban
- `models/RefreshToken.js` — hashed (SHA-256) refresh tokens, Mongo TTL index
  auto-expires old ones
- `utils/tokens.js` — access token 15m, refresh token 30d (rotates, single-use)
- `controllers/authController.js` — login (lockout-aware, issues token pair),
  refresh (rotates + re-checks ban/store status), logout, listSessions,
  revokeSession, logoutAll
- `routes/authRoutes.js` — `/refresh`, `/logout`, `/logout-all`, `/sessions`,
  `/sessions/:id`
- `models/AuditLog.js` + `utils/audit.js` — fire-and-forget logging
- `controllers/adminController.js` — audit logging on approve/reject/ban/
  unban/appeal-resolve/user-ban/user-unban; new `auditLog` export
- `controllers/reviewController.js` — audit logging on admin review removal
- `routes/adminRoutes.js` — `GET /admin/audit-log`
- All pass `node --check` + full module-load smoke test; token/lock logic
  unit-tested without a DB (all correct)

### Frontend
- `api/axios.js` — silent single-flight refresh-on-401, retries original
  request once; `ACCOUNT_LOCKED` + 423 handled as force-logout
- `context/AuthContext.jsx` — `login()` stores refresh token; `logout()`
  revokes it server-side first
- `pages/Login.jsx` — passes refresh token through to `login()`
- `pages/SecuritySettings.jsx` — new page: session list, per-session revoke,
  "Log out everywhere"; reachable via a 🔒 icon in `AppShell` (every role)
- `App.jsx` — `/security` route added
- `pages/dashboards/AdminDashboard.jsx` — new "Audit Log" tab
- No new CSS needed — reused existing `.row-list`/`.row-item`/`.status-pill`/
  `.icon-toggle` classes
- Client builds cleanly (`npm run build`)

### Decisions made
- Access tokens shortened 2h → 15m now that silent refresh exists.
- Lockout and the existing login rate-limiter are complementary (per-account
  vs per-IP), both kept.
- Admin unban also clears any lockout on that user.
- Audit log is read-only from the UI; no edit/delete of entries.

### Known gaps / not verified
- No MongoDB available in the build sandbox — integration-tested nothing
  that requires a live DB (login → lock → unlock cycle, actual refresh
  rotation, session list against real tokens). Logic was unit-tested in
  isolation instead. **Verify these after deploying** (see README
  "Verification status" section for the exact checklist).
- Refresh tokens are stored in `localStorage` (same place as the access
  token was already), not an httpOnly cookie — consistent with how this
  app already handled auth, but worth knowing: an XSS vuln could still
  steal a refresh token, same as it already could steal the access token.
  Switching to httpOnly cookies would be a bigger architecture change
  (CSRF handling, cross-origin cookie config for the separate Render
  frontend/backend) — flagged here, not done, since it wasn't asked for.

## Batch: UI animations
## Status: ✅ DONE

CSS-driven, no new dependencies. Scope: page transitions, button/card
micro-interactions, modal/drawer/dropdown entrances, a few attention cues,
and chart bars growing in. Respects `prefers-reduced-motion`.

### What was added
- `components/AppShell.jsx` — page content now keyed by route path and
  given a `page-enter` class, so every navigation gets a brief fade+rise
  instead of popping in
- `components/NotificationBell.jsx` — bell icon "rings" (rotates) when the
  unread count genuinely increases (not on first load, not when a read
  action lowers it); unread badge pops in with a bounce
- `pages/StoreAnalytics.jsx` — revenue bar chart bars grow upward on
  render, staggered left-to-right (`animationDelay` per bar, capped at
  400ms so a 90-day chart doesn't take forever to finish animating)
- `App.css` — new keyframes (`fadeInUp`, `fadeIn`, `scaleIn`,
  `slideInRight`, `slideDownFade`, `bellRing`, `pulseRing`, `pulseSoft`,
  `growBar`, `popIn`) and the rules that use them:
  - Buttons: hover lift + press "squish" on solid/ghost/danger buttons,
    icon buttons, tabs
  - Cards: gentle hover lift on panels/KPIs/product/order/store/feature
    cards (store cards already had a version of this - unified timing)
  - Modal and cart drawer: fade+scale-in / slide-in-from-right on open
  - Notification dropdown: slide-down-fade on open
  - Attention cues: the current step in an order tracker pulses; a
    "pending"/new-order status pill pulses softly; the hot order-count
    badge on the Orders tab pulses
  - Star rating buttons scale up on hover
  - Grid entrances: KPI/product/store/feature cards fade up with a small
    stagger (first ~6 items) on page load
  - A top-level `@media (prefers-reduced-motion: reduce)` rule collapses
    all animation/transition durations to near-zero for anyone who's
    asked their OS for that

### Decisions made
- Kept everything CSS-only except the two small bits of JS state needed
  (bell ring trigger, route-keyed remount for page transitions, chart bar
  stagger) - no animation library added, keeps the bundle size basically
  unchanged (CSS grew ~5KB gzipped, JS barely moved).
- Animations are intentionally quick (120–350ms) and use `ease`/standard
  easing curves rather than bouncy/playful ones almost everywhere, to
  match the existing fairly professional/utilitarian visual style - the
  one exception is the badge "pop" and star-hover scale, which use a
  slight overshoot curve since those are meant to feel a little more fun.

### Known gaps / not verified
- Client builds cleanly (`npm run build`), but I could **not** get a live
  browser preview running in this sandbox to visually confirm the
  animations look right in motion (the preview server attempt hung and
  was killed) - CSS was reviewed by eye for correctness but not watched
  running. Please eyeball it after deploying, in particular: the chart
  bar stagger timing, and that the page-transition doesn't feel janky on
  slower devices.
- Didn't touch `CartDrawer.jsx`/`ReviewModal.jsx`/`ReasonModal.jsx`/
  `StoreBannedGate.jsx` individually - they get their entrance animation
  "for free" since they all reuse the shared `.modal`/`.drawer` classes.

## Batch: Frontend polish — toasts, confirm dialogs, skeletons, page titles
## Status: ✅ DONE

Client-only, no backend/API changes. Goal: make the app feel smoother and
more consistent, and get rid of native browser dialogs which look out of
place next to the rest of the UI.

### What was added
- `context/ToastContext.jsx` — global toast notifications (`useToast()` →
  `toast('message', { type: 'success'|'error'|'info' })`), auto-dismiss,
  stacks in the bottom-right, click to dismiss early
- `context/ConfirmContext.jsx` — promise-based confirm dialog
  (`useConfirm()` → `await confirm('message', { title, confirmLabel,
  danger })`), reuses the existing `.modal`/`.modal-backdrop` styling so it
  looks identical to the app's other modals
- `components/Spinner.jsx` — tiny inline spinner for busy buttons
- `components/Skeleton.jsx` — `SkeletonBlock`/`SkeletonCard`/`SkeletonGrid`/
  `SkeletonRows`, shimmering placeholders instead of bare "Loading..." text
- `components/ScrollToTop.jsx` — resets scroll position on every route
  change (previously: navigating to a new page while scrolled down kept
  you scrolled down, which felt broken)
- `utils/usePageTitle.js` — sets `document.title` to "<Page> · PureGasly"
  per page, restores the previous title on unmount
- Wired `ToastProvider` + `ConfirmProvider` + `ScrollToTop` into `App.jsx`

### Replaced every `window.confirm(...)` with the new confirm dialog
(native browser confirms look jarring and inconsistent with the app's
styling - all 7 call sites fixed):
`CustomerOrders.jsx` (cancel order), `ManageInventory.jsx` (remove
product), `ManageRiders.jsx` (remove rider), `ManageEmployees.jsx` (remove
employee), `StoreOrders.jsx` (decline order), `SecuritySettings.jsx`
(log out everywhere), `AdminDashboard.jsx` Reviews tab (remove review).

### Added toast feedback for actions that were previously silent
(reload-and-hope) or used a hand-rolled local "flash" banner:
`ManageInventory.jsx` (replaced its own local flash-message state with the
global toast), `CustomerOrders.jsx`, `StoreOrders.jsx` (incl. rider
assign/unassign), `ManageRiders.jsx`, `ManageEmployees.jsx`,
`SecuritySettings.jsx`, and every action across `AdminDashboard.jsx`'s
Applications/Stores/Users/Reviews tabs (approve, reject, ban, unban,
appeal approve/deny, remove review).

### Added skeleton loaders (replacing plain "Loading..." text) to
the highest-traffic loading states: `CustomerDashboard.jsx` (store/product
browse grid - the single most-viewed loading state in the app, and the
single-store detail view), `StoreOrders.jsx`, `CustomerOrders.jsx`,
`ManageInventory.jsx` (table rows), `ManageRiders.jsx`,
`SecuritySettings.jsx`, `StoreAnalytics.jsx` (KPI grid + reviews list), and
every tab in `AdminDashboard.jsx`.

### Added page titles (`usePageTitle`) to every route
Login, Register, Shop (customer), Dashboard (owner/employee), My
Deliveries (rider), Orders (both customer and store sides), Inventory,
Riders, Employees, Analytics, Admin, Security.

### Added button spinners for busy/async actions
Login, Register, inventory Save/Add Product, rider Add Rider, employee Add
Employee, session revoke — anywhere a button already showed "Saving.../
Adding..." text now also shows a small spinning indicator next to it.

### Decisions made
- Kept toast and confirm as **context-provided hooks** rather than
  per-page local state, specifically so every page gets the exact same
  look/behavior for free and future pages don't need to reinvent it.
- Toasts are for *feedback after an action completes* (success or
  server-rejected error); form-level validation errors stay inline next to
  the form, not as a toast, since those need to stay visible while the
  person fixes the field.
- Confirm dialogs default to `danger: true` (red confirm button) since
  most current uses are destructive actions; pass `danger: false`
  explicitly for a neutral one if a future non-destructive confirm is
  needed.
- Didn't skeleton-ify genuinely low-traffic or rarely-empty states (e.g.
  `EmployeeDashboard.jsx`, `ManageEmployees.jsx`'s employee list still use
  the old `placeholder-note`/text loading) - lower payoff for the effort;
  can revisit later if desired.

### Known gaps / not verified
- Client builds cleanly (`npm run build`); same as the animations batch, I
  do not have a working live-browser preview in this sandbox, so the
  toast stack position/stacking, confirm-dialog animation, and skeleton
  shimmer were reviewed by reading the CSS/JSX, not watched running.
  Please eyeball these after deploying.
- `ManageEmployees.jsx` still has its own older visual style
  (`.manage-card`, `.employee-row`, etc. - predates the shared
  `AppShell`/`.panel`/`.row-item` pattern used everywhere else) and wasn't
  restyled to match in this batch, only had toasts/confirm/spinner added
  on top of its existing look. Worth a proper visual pass later so it
  matches `ManageRiders.jsx` (which already uses the shared style).

## Batch: Favorites, saved addresses, coupons, CSV export
## Status: ✅ DONE

Four features this round, spread evenly across customer and store sides as
requested. Unlike the "UI animations"/"frontend polish" batches, this one
touches the API (favorites/addresses/coupons all needed real backend
support to persist and to validate server-side).

### Backend
- `models/Favorite.js` — `{customer, targetType: 'store'|'product',
  targetId}`, unique per customer+target so double-favoriting is a no-op
- `models/Address.js` — labeled saved addresses per customer, one
  `isDefault` at a time (enforced in the controller, not the schema)
- `models/Coupon.js` — `{storeId, code (unique per store), type:
  'percent'|'fixed', value, minOrder, maxUses, usedCount, expiresAt,
  active}`
- `models/Order.js` — added `subtotal`, `discount`, `couponCode` (kept
  `total` as the final post-discount amount, unchanged meaning everywhere
  else that already reads `total` - analytics revenue numbers are
  automatically correct with no analytics code changes needed)
- `utils/coupons.js` — `checkCoupon(storeId, code, subtotal)`, the single
  source of truth for discount math (percent, fixed, min-order, expiry,
  usage-limit checks); used by both the customer-facing "validate" preview
  endpoint and order creation itself, so the preview and the real checkout
  can never disagree
- `controllers/favoriteController.js`, `addressController.js`,
  `couponController.js` + matching routes
  (`favoriteRoutes.js`/`addressRoutes.js`/`couponRoutes.js`)
- `controllers/orderController.js` — `create` now accepts an optional
  `couponCode`, re-validates it server-side (never trusts a client-sent
  discount), computes `subtotal`/`discount`/`total`, and increments the
  coupon's `usedCount` after the order is confirmed created
- `controllers/storeOrderController.js` — exposes `subtotal`/`discount`/
  `couponCode` to the store's order view too
- `utils/receipt.js` (PDF) — shows a Subtotal/Discount breakdown line when
  a coupon was applied, full Total only otherwise (no visual change for
  orders without a coupon)
- New employee permission: `manage_coupons` (added to
  `employeeController.js`'s `VALID_PERMISSIONS` and the client's
  `ManageEmployees.jsx` permission list)
- `middleware/storeAccess.js`'s existing any-of-permissions support
  (from the riders batch) reused so `manage_orders` staff can still *view*
  coupons for context, but only `manage_coupons` staff can create/edit/
  delete them
- `server.js` — wired `/api/favorites`, `/api/addresses`, `/api/coupons`
- All backend files pass `node --check` + full module-load smoke test;
  discount math (percent/fixed/cap-at-subtotal) unit-tested without a DB

### Frontend
- `context/FavoritesContext.jsx` — loads the customer's favorite ids once,
  optimistic toggle (updates the heart instantly, reverts + toasts an
  error if the request fails)
- `pages/dashboards/CustomerDashboard.jsx` — `ProductCard`/`StoreCard` are
  now named exports (reused by the new Favorites page) and both got a
  heart toggle button
- `pages/Favorites.jsx` — new page, Stores/Products tabs, reuses the same
  cards; clicking a favorited store deep-links back into the Shop tab and
  opens that store (via router `state`, since store detail isn't its own
  URL route)
- `pages/AddressBook.jsx` — new page: add/remove saved addresses, set
  default
- `pages/ManageCoupons.jsx` — new page: create/disable/remove coupons,
  shows usage count, expiry, min-order at a glance
- `components/CartDrawer.jsx` — rewritten: loads saved addresses and
  auto-fills the default one (with a dropdown to pick another or enter a
  new one-off address), coupon code field with live validation
  (`POST /coupons/validate`) showing the discount before placing the
  order; discount is cleared automatically if the cart total changes
  after a coupon was applied, so a stale discount can never sneak through
- `pages/CustomerOrders.jsx` / `pages/StoreOrders.jsx` — order item lists
  now show a coupon/discount line when one was applied
- `utils/csv.js` — tiny dependency-free CSV export (RFC 4180 escaping,
  UTF-8 BOM so ₱ doesn't come out as mojibake in Excel)
- `pages/StoreOrders.jsx` — "Export CSV" button, exports full order
  history (not just the current tab) with coupon/discount columns
- `pages/StoreAnalytics.jsx` — "Export CSV" button, exports the daily
  revenue series for the selected date range
- `components/AppShell.jsx` — nav links added: Favorites + Addresses
  (customer), Coupons (owner/employee with `manage_orders` or
  `manage_coupons`)
- New CSS: `.fav-btn` (heart button, restyled `.store-card` to nest an
  inner clickable button so the heart can sit on top without being
  inside the navigation button), `.coupon-row`/`.coupon-applied`/
  `.discount-row`/`.cart-grand-total`, `.discount-line` (order item list)
- Client builds cleanly (`npm run build`)

### Decisions made
- Coupons are per-store, not platform-wide — each store owner manages
  their own codes, consistent with everything else in the app being
  store-scoped.
- A coupon's discount is capped so it can never exceed the subtotal
  (no negative totals), and `usedCount` increments only after the order
  is actually created (best-effort, doesn't block/fail the order if the
  increment itself has a hiccup).
- Didn't make favorited/saved coupon codes publicly listed on the store
  page (e.g. "promo codes available here") - kept it opt-in/know-the-code,
  matching how most real coupon systems work, and avoids leaking unused
  codes to anyone just browsing.
- CSV export is client-side, built from data the page already fetched
  (not a new streaming backend endpoint) - simplest option, and
  `StoreOrders.jsx` already fetches up to 300 orders which comfortably
  covers "history" for a store this app's scale. If a store ever
  genuinely needs more than that exported, a dedicated backend export
  endpoint would be the next step (not built - flagging, not needed yet).

### Known gaps / not verified
- No live MongoDB in the sandbox, so the full save → checkout → validate
  → order-created loop for coupons, and the saved-address-fills-checkout
  flow, were not run end-to-end. Discount math itself was unit-tested in
  isolation (see Backend section) and is correct; what's unverified is
  the plumbing around it (the live validate call, usedCount incrementing
  in a real DB, etc).
- Minor cosmetic overlap: on a product that's both on promo (shows a
  diagonal "PROMO" ribbon) and favoritable, the heart button and the
  ribbon's corner can visually overlap slightly. Not functionally broken,
  just not perfectly tidy - noting for a future visual pass.
- `Favorites.jsx`'s favorited-store cards don't show live stats
  (product count, price range, rating) since the `/favorites` endpoint
  returns lightweight store info, not the full shop-listing shape - they
  show a plain card with name/address/description only. Could enrich
  later by reusing the shop-listing aggregation if it turns out to matter.

## Batch: Bug sweep
## Status: ✅ DONE

A dedicated pass looking for bugs across everything built so far, not a new
feature batch. Found and fixed real issues, ranked by how serious they were.

### 🔴 Serious - would have broken in production
- **Legacy orders would crash on save.** Coupons added a `required: true`
  `subtotal` field to the existing `Order` model. Any order placed *before*
  this deploy has no `subtotal` stored. Mongoose only enforces `required`
  on `.save()`/`.create()`, not on reads - so old orders loaded fine, but
  the moment code called `.save()` on one (leaving a review, assigning a
  rider, a store-ban cancelling its pending orders) it would throw
  `"subtotal is required"` and fail with a 500, for reasons that would
  have looked completely unrelated to coupons. **Fixed:** added a
  migration to `bootstrap/bootstrap.js` (runs automatically on every
  server start, same pattern as the existing store/user migrations) that
  backfills `subtotal = total`, `discount = 0`, `couponCode = ''` on any
  order missing them, via a single atomic aggregation-pipeline update
  (not a read-modify-write loop). Audited every other `required: true`
  field across all models to confirm this was the only instance of a
  required field added to a *pre-existing* collection - every other new
  required field belongs to a brand-new collection (Review, Favorite,
  Address, Coupon, etc.) with no legacy data to worry about.
- **Coupon usage-limit race condition.** `maxUses` was enforced with a
  read-then-write (check `usedCount < maxUses`, then separately
  increment) - two simultaneous checkouts both reading the limited
  coupon's last available use could both pass the check and both get the
  discount, overrunning the limit. **Fixed:** split `utils/coupons.js`
  into `checkCoupon` (unchanged, read-only - used by the cart's live
  preview, must NOT consume a use just for previewing) and a new
  `claimCoupon` (used only at actual order creation) that checks and
  increments in a single atomic conditional `findOneAndUpdate` - the
  usage limit can no longer be overrun no matter how many requests hit it
  at once. Also fixed order creation to refund the claimed use if order
  creation fails after the claim succeeded (was already doing this for
  stock reservation via `restoreStock`; coupons now get the same
  rollback treatment).
- **Riders were invisible to admin moderation.** `adminController.listUsers`
  only ever queried `role: {$in: ['customer','owner','employee']}` -
  riders (added in an earlier batch) were silently excluded from the
  entire list, filter, and ban/unban UI. There was **no way for an admin
  to ban a rider** through the app at all, even though the backend ban
  endpoint itself works fine for any non-admin role. **Fixed:** added
  `'rider'` to the allowed role filter and the default list, added a
  Rider tab to the admin Users view, added a Riders count to admin stats.

### 🟡 Real but narrower
- **Stale-closure bug in favoriting.** `FavoritesContext`'s optimistic
  toggle captured the *pre-toggle* Set in a closure and reverted to that
  exact snapshot on failure. Quickly favoriting two different items of
  the *same type* (both stores, or both products) while the first
  request was still in flight, then having the first one fail, would
  revert and silently wipe out the second item's already-successful
  change too. **Fixed:** rewrote `toggle` to use functional state
  updates for both the optimistic change and the revert, so it's always
  relative to the current state rather than a stale snapshot.
- **A banned rider could still be "assigned" a delivery.** The rider
  picker in `StoreOrders.jsx` (and the underlying `GET /api/riders` list)
  didn't filter out banned riders - an owner could assign an order to
  someone who's now blocked from logging in to ever see or act on it.
  **Fixed:** the assignment dropdown now excludes banned riders; if an
  order was already assigned to someone who got banned afterward, that
  option still shows (labeled "(banned — reassign)") so the dropdown
  doesn't look broken and the owner has a clear path to fix it. Also
  added a banned badge + reason to the owner's own Riders management
  page, and exposed `banReason` from the riders API (was missing).
- **Cart drawer silently reset on reopen.** The saved-address auto-fill
  ran on every single opening of the cart drawer, not just the first -
  accidentally closing the drawer (e.g. clicking the backdrop) mid-edit
  and reopening it would wipe out a manually-typed or manually-selected
  address back to the default, with no warning. **Fixed:** the
  auto-select-default behavior now only fires once per cart session (via
  a ref flag), while the address *list* itself still refreshes normally
  each time, so a newly-added address would still show up as an option
  without stomping on an in-progress selection.
- **`window.confirm` survived in one spot.** The "replace all native
  confirms" sweep two batches ago searched `pages/` and `components/`
  only - missed `context/CartContext.jsx`'s "switch stores, clear cart?"
  confirm. **Fixed:** now uses the same `useConfirm()` dialog as
  everywhere else (and reworded slightly - was phrased as a yes/no
  question, now states what will happen).

### 🟢 Minor / cleanup
- Duplicate-key races on account creation (two simultaneous signups with
  the same email) fell through to a generic 500 instead of a friendly
  409 in `authController.register`, `employeeController.create`, and
  `riderController.create` - this pattern was already handled correctly
  in the more recently-built coupon/favorite/review code, just hadn't
  been applied to these three older spots. Fixed all three for
  consistency. Extremely narrow race window, never data-unsafe (the
  DB's unique index on email was always the real backstop) - just a
  worse error message in the rare case.
- Removed genuinely dead code in `favoriteController.js` (`storeMap`/
  `storeNameFor` were computed but never used).

### Verified NOT to be bugs (checked and ruled out)
- The axios silent-refresh interceptor: no infinite-loop risk (the raw
  refresh call bypasses the interceptor entirely), no duplicate-refresh
  race (single-flight promise correctly shared across simultaneous 401s).
- `Review`'s one-review-per-order: the pre-check read isn't atomic, but
  the model's unique index on `order` is the actual backstop and
  correctly rejects a true duplicate at the DB level either way.
- Route ordering in `couponRoutes.js` (the public `/validate` route is
  correctly registered before the store-auth `router.use`, so it's
  genuinely unauthenticated-to-staff/customer-only as intended).
- `Favorites.jsx` passing an incomplete store-stats shape to the reused
  `StoreCard` component doesn't crash (`RatingStars` short-circuits
  safely on a null value) - confirmed this is the already-documented
  "favorited stores don't show live stats" gap from the previous batch,
  not a new issue.

### Known gaps / not re-verified
- As with every batch so far, there's no live MongoDB in this sandbox.
  The coupon race fix, the legacy-order migration, and the
  admin-can-now-ban-a-rider flow are all logically sound and were
  checked as carefully as possible without a database, but the actual
  concurrent-request behavior and the migration running against real
  data have **not** been observed end-to-end. Worth specifically
  testing after deploy: ban a rider from the new admin tab and confirm
  they're logged out / blocked, and check the server's startup logs for
  a "Migrated legacy data: ... order(s)" line confirming the backfill ran
  (only prints if there was anything to migrate).
- Did not go looking for bugs in Phases 5-9 with the same depth as this
  pass focused on - this sweep concentrated on the riders/coupons/
  favorites/addresses work plus anything it touched, since that's both
  the newest and the highest-risk code (newest = least battle-tested,
  and the required-field addition was exactly the kind of thing that
  silently breaks older data). A similar close pass over the earlier
  phases hasn't been done and could still turn something up.

## Earlier batches (for context, not re-verified here)
- Phase 5: admin approval flow, bans/appeals, inventory+sales, orders with
  delivery phases, analytics — see README "What's new in Phase 5"
- Phase 6: notifications, riders, PDF receipts, ratings/reviews, dark mode
  — see README "What's new in Phase 6"
