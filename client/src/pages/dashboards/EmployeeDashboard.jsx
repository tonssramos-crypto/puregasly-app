import { Link } from 'react-router-dom';

export default function EmployeeDashboard({ user }) {
  const has = (perm) => user.permissions?.includes(perm);
  const none = !user.permissions || user.permissions.length === 0;

  return (
    <>
      <div className="hero">
        <div>
          <h1>Welcome, {user.name}!</h1>
          <p>Store: {user.store?.name || 'Not assigned yet'}</p>
        </div>
        <span className="role-badge">Employee</span>
      </div>

      <div className="feature-grid big">
        {has('manage_orders') && (
          <Link to="/store-orders" className="feature-card clickable">Orders<span>Accept & update deliveries</span></Link>
        )}
        {has('manage_inventory') && (
          <Link to="/inventory" className="feature-card clickable">Inventory & Sales<span>Products & stock</span></Link>
        )}
        {has('view_analytics') && (
          <Link to="/analytics" className="feature-card clickable">Analytics<span>Revenue & top products</span></Link>
        )}
        {has('manage_riders') && <div className="feature-card">Riders<span>Coming soon</span></div>}
        {none && <div className="feature-card">No permissions assigned yet<span>Ask your owner</span></div>}
      </div>

      <p className="placeholder-note">
        Employees are created by their store owner, and the owner decides which sections each employee can open.
      </p>
    </>
  );
}
