import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../utils/usePageTitle';

// Keep in step with PRIVACY_POLICY_VERSION in server/utils/privacy.js, and with
// the retention windows in server/utils/privacy.js (RETENTION).
const POLICY_VERSION = '2026-10-15';
const CONTACT = import.meta.env.VITE_PRIVACY_EMAIL || 'privacy@your-domain.example';

export default function PrivacyPolicy() {
  usePageTitle('Privacy Policy');
  const { user } = useAuth();

  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <Link to={user ? '/dashboard' : '/login'} className="legal-back">
          ← Back to PureGasly
        </Link>

        <h1>Privacy Policy</h1>
        <p className="muted small">Version {POLICY_VERSION}</p>

        <p>
          PureGasly connects customers with LPG stores for delivery. This page explains what personal information we
          collect, why, who sees it, how long we keep it, and the choices you have. We follow the Philippine Data
          Privacy Act of 2012 (Republic Act No. 10173).
        </p>

        <h2>What we collect, and why</h2>
        <div className="legal-table" role="table">
          <div className="legal-row legal-head" role="row">
            <span>Information</span>
            <span>What we use it for</span>
          </div>
          <div className="legal-row" role="row">
            <span>Name, e-mail address, password</span>
            <span>Creating your account and signing you in. Your password is stored only as a one-way hash.</span>
          </div>
          <div className="legal-row" role="row">
            <span>Delivery address, contact number, order notes</span>
            <span>Delivering the order you placed. Stored encrypted. Saved addresses exist only if you add them.</span>
          </div>
          <div className="legal-row" role="row">
            <span>Order history, reviews, favorites</span>
            <span>Showing your orders and receipts, and letting stores fulfil them.</span>
          </div>
          <div className="legal-row" role="row">
            <span>Browser / device type of your sign-ins</span>
            <span>Showing your active sessions and warning you about sign-ins from a new device.</span>
          </div>
        </div>
        <p>We use this information only for these purposes. We do not sell it and we do not use it for advertising.</p>

        <h2>Who can see it</h2>
        <p>
          The store you order from sees your first and last name, delivery address, contact number and order notes for
          that order only. A rider assigned to your order sees the same details, but only while the delivery is in
          progress. Stores do not receive your e-mail address. Platform administrators can see account details
          (name, e-mail, role) so they can run and moderate the service. Service providers that host our systems
          process data on our behalf under appropriate safeguards.
        </p>

        <h2>How long we keep it</h2>
        <ul>
          <li>Delivery address, contact number and notes on finished orders are removed after 365 days. Totals and items remain for the store's records.</li>
          <li>Notifications are deleted after 90 days.</li>
          <li>Sign-in sessions expire after 30 days of the sign-in, or when you log out.</li>
          <li>Administrator action logs are deleted after 2 years.</li>
          <li>If you delete your account, your personal data is erased immediately as described below.</li>
        </ul>

        <h2>Your rights</h2>
        <ul>
          <li><strong>Access and portability.</strong> Download a copy of your data from Security → Your data.</li>
          <li><strong>Correction.</strong> Edit your saved addresses and contact numbers in the Addresses page.</li>
          <li><strong>Erasure.</strong> Customers can delete their account from Security → Delete account. Saved addresses, favorites, notifications and sessions are deleted; the delivery details on past orders are removed; your name and e-mail are replaced with anonymous placeholders. You can delete once you have no order in progress.</li>
          <li><strong>Withdraw consent / object.</strong> Contact us at the address below. Withdrawing consent means we can no longer provide the service to you.</li>
          <li><strong>Complain.</strong> You may lodge a complaint with the National Privacy Commission (privacy.gov.ph).</li>
        </ul>

        <h2>How we protect it</h2>
        <p>
          Connections use HTTPS. Passwords are hashed with bcrypt. Delivery addresses and phone numbers are encrypted
          in the database. Sessions use short-lived access tokens and a protected cookie that scripts on the page
          cannot read. Accounts lock after repeated failed sign-ins, and you can see and end your sessions at any time.
          No system is perfectly secure; if a breach affecting you occurs we will notify you and the National Privacy
          Commission as the law requires.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or requests about your data: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
        <p className="muted small">
          We will tell you in the app when this policy changes in a way that needs your consent again.
        </p>
      </div>
    </div>
  );
}
