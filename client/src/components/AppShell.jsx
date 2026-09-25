import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';

function navFor(user) {
  const has = (p) => user.role === 'owner' || user.permissions?.includes(p);
  const links = [{ to: '/dashboard', label: 'Dashboard', end: true }];

  if (user.role === 'customer') {
    links[0].label = 'Shop';
    links.push({ to: '/orders', label: 'My Orders' });
  }
  if (user.role === 'owner' || user.role === 'employee') {
    if (has('manage_orders')) links.push({ to: '/store-orders', label: 'Orders' });
    if (has('manage_inventory')) links.push({ to: '/inventory', label: 'Inventory' });
    if (has('view_analytics')) links.push({ to: '/analytics', label: 'Analytics' });
    if (user.role === 'owner') links.push({ to: '/employees', label: 'Employees' });
  }
  return links;
}

export default function AppShell({ children, wide }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const cart = useCart();

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
          <span className="user-chip" title={user.email}>
            {user.name}
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      <div className="page-main">
        <div className={wide ? 'page wide' : 'page'}>{children}</div>
      </div>

      {user.role === 'customer' && <CartDrawer />}
    </div>
  );
}
