import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';
import NotificationBell from './NotificationBell';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import api from '../api/axios';

function navFor(user) {
  const has = (p) => user.role === 'owner' || user.permissions?.includes(p);
  const links = [{ to: '/dashboard', label: 'Dashboard', end: true }];

  if (user.role === 'customer') {
    links[0].label = 'Shop';
    links.push({ to: '/orders', label: 'My Orders' });
    links.push({ to: '/favorites', label: 'Favorites' });
    links.push({ to: '/addresses', label: 'Addresses' });
  }
  if (user.role === 'rider') {
    links[0].label = 'My Deliveries';
  }
  if (user.role === 'owner' || user.role === 'employee') {
    if (has('manage_orders')) links.push({ to: '/store-orders', label: 'Orders' });
    if (has('manage_inventory')) links.push({ to: '/inventory', label: 'Inventory' });
    if (has('manage_orders') || has('manage_coupons')) links.push({ to: '/coupons', label: 'Coupons' });
    if (has('view_analytics')) links.push({ to: '/analytics', label: 'Analytics' });
    if (has('manage_orders') || has('manage_riders')) links.push({ to: '/riders', label: 'Riders' });
    if (user.role === 'owner') links.push({ to: '/employees', label: 'Employees' });
  }
  return links;
}

export default function AppShell({ children, wide }) {
  const { user, logout, refresh } = useAuth();
  const [consenting, setConsenting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { theme, toggle } = useTheme();

  // Accounts created before consent was captured, staff/riders created by an
  // owner, and everyone after a policy update are asked to review and accept.
  async function acceptPolicy() {
    setConsenting(true);
    try {
      await api.post('/auth/consent', { accept: true });
      await refresh();
    } catch {
      // The banner simply stays; they can try again.
    } finally {
      setConsenting(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="dashboard-shell">
      <div className="topbar">
        <Link to="/dashboard" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/assets/logo.png" alt="PureGasly logo" />
          <span>PureGasly</span>
        </Link>

        <nav className="topnav">
          {navFor(user).map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-right">
          {user.role === 'customer' && (
            <button className="cart-btn" onClick={() => cart.setOpen(true)}>
              🛒 Cart{cart.count > 0 && <span className="cart-count">{cart.count}</span>}
            </button>
          )}
          <button className="icon-toggle" onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
          <button className="icon-toggle" onClick={() => navigate('/security')} aria-label="Security" title="Security">
            🔒
          </button>
          <span className="user-chip" title={user.email}>
            {user.name}
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      {user.consent && !user.consent.accepted && (
        <div className="consent-banner" role="region" aria-label="Privacy policy">
          <span>
            Please review our <Link to="/privacy">Privacy Policy</Link> and confirm you agree to how your information is used.
          </span>
          <button className="btn-solid small" onClick={acceptPolicy} disabled={consenting}>
            {consenting ? 'Saving...' : 'I agree'}
          </button>
        </div>
      )}

      <div className="page-main">
        <div key={location.pathname} className={wide ? 'page wide page-enter' : 'page page-enter'}>
          {children}
        </div>
      </div>

      <footer className="app-footer">
        <Link to="/privacy">Privacy Policy</Link>
      </footer>

      {user.role === 'customer' && <CartDrawer />}
    </div>
  );
}
