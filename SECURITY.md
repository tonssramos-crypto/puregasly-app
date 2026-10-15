# PureGasly - Security & Privacy Notes (Phase 16)

## What changed, by review criterion

| Criterion | Before | After | Main changes |
|---|---|---|---|
| Input validation (15) | 12 | 14 | Shared password validator; strict type checks on register, login, orders, coupons; ID check on coupon validation; real length limits enforced in controllers |
| Authentication (15) | 6 | 10* | No default admin password; 10+ char policy with common-password / email checks; bcrypt cost 12 + auto-upgrade; change-password; timing-safe login; new-device alert |
| Authorization (15) | 13 | 14 | Password change instantly invalidates old access tokens; deleted accounts blocked everywhere; store staff no longer receive customer e-mails; riders only see contact data for live deliveries |
| Error handling (15) | 12 | 14 | Redacting logger (no raw error objects / duplicate-key values); crash handlers; startup config checks; CORS/HTTPS fail closed |
| Data protection (15) | 8 | 13 | Refresh token in httpOnly cookie + in-memory access token; AES-256-GCM encryption of address/phone/notes; HTTPS enforcement + HSTS; strict CORS; refresh-token reuse detection |
| Privacy controls (15) | 4 | 12 | Versioned consent at sign-up (+ banner for existing users); Privacy Policy page; data export; account erasure; retention job; data minimisation |
| Session & account security (10) | 7 | 9 | Atomic token rotation, family revocation, CSRF origin check, sessions revoked on password change |
| **Total (100)** | **62** | **86** | |

\* Authentication is capped because **MFA is intentionally not implemented yet**. Adding TOTP for admin/owner accounts would add roughly 4-5 points.

These are my own estimates from a code review, not a formal audit.

## Required environment variables (production)

| Variable | Purpose |
|---|---|
| `NODE_ENV=production` | Enables HTTPS enforcement, Secure cookies, strict startup checks |
| `JWT_SECRET` | 32+ random chars |
| `FIELD_ENCRYPTION_KEY` | 32+ random chars. **Back it up** - losing it makes encrypted addresses/phones unreadable. Do not change it without a re-encryption plan |
| `CLIENT_ORIGIN` | Your website URL(s), comma-separated |
| `ADMIN_PASSWORD` | 12+ chars, not the old default |
| `COOKIE_SAMESITE` | Optional. Default `none` in production (site + API on different subdomains). Use `lax`/`strict` if both are on one domain |

## IMPORTANT: cookies and Render's default URLs

The refresh cookie is sent from the website to the API. On Render's free URLs
(`puregasly-web.onrender.com` and `puregasly-api.onrender.com`) browsers treat
these as **different sites**, and Safari / iOS and some privacy settings block
cross-site cookies. Symptom: login works but you are signed out on reload.

Fix (recommended): give both services subdomains of **one domain you own**, e.g.
`app.yourdomain.com` and `api.yourdomain.com`, then set `COOKIE_SAMESITE=lax`
on the API and `CLIENT_ORIGIN=https://app.yourdomain.com`. Chrome/Firefox on the
plain onrender.com URLs work as-is with the defaults (SameSite=None; Secure).

## Upgrading an existing deployment

1. Set the variables above **before** deploying - the API refuses to start without them.
2. Existing users stay logged in only until their access token expires (15 min); after that they must log in again (the cookie-based session is new). Old localStorage tokens are cleaned up automatically.
3. Existing plaintext addresses/phones keep working and are encrypted the next time each record is saved. To encrypt everything at once, load and re-save the documents in a one-off script.
4. Existing users have no consent recorded and will see a banner asking them to accept the Privacy Policy.
5. Rotate the admin password if the old default was ever deployed (the server does this automatically when `ADMIN_PASSWORD` is set).

## Verify after deploy (not testable without MongoDB)

- Log in, confirm DevTools -> Application shows **no tokens in localStorage** and a `pg_rt` cookie flagged HttpOnly + Secure.
- Reload the page: you stay signed in (silent refresh works across the two Render subdomains).
- Change password in a second browser: the first is signed out within 15 minutes (or on its next refresh).
- Place an order, check the database: `deliveryAddress` starts with `enc:v1:`.
- Download "my data", then delete a test customer account and confirm orders show `[deleted]` and the user row is anonymised.
- Ban a user / suspend a store and confirm the existing behaviour still works.

## Known remaining gaps

- **No MFA** (deferred as requested).
- **No forgot-password / e-mail verification** - both need an e-mail provider. Until then, a forgotten password needs an admin/DB reset.
- **Account enumeration** on registration (409 "already exists") cannot be removed without e-mail verification.
- **Lockout can be abused** to temporarily lock a victim's account (per-account lock, 15 min). IP rate limits reduce but don't remove this.
- **Client dependencies:** `react-router` 6.x has an open-redirect advisory with no 6.x patch (the app only navigates to fixed internal paths); upgrading to v7 is a breaking change to plan separately. `vite`/`esbuild` advisories affect the dev server only.
- Owners/employees/riders cannot self-delete (managed by owner/admin); admin-created accounts carry no consent until first login (banner).
- The privacy policy text is a template: replace the contact e-mail (`VITE_PRIVACY_EMAIL`), and have it reviewed against your actual operations / the Data Privacy Act obligations (e.g. NPC registration, a named Data Protection Officer).
