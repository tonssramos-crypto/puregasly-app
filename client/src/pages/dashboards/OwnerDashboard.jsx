import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { errMsg, formatPHP } from '../../utils/format';
import usePageTitle from '../../utils/usePageTitle';

export default function OwnerDashboard({ user }) {
  usePageTitle('Dashboard');
  const { refresh } = useAuth();
  const [stats, setStats] = useState(null);

  const [address, setAddress] = useState(user.store?.address || '');
  const [phone, setPhone] = useState(user.store?.phone || '');
  const [description, setDescription] = useState(user.store?.description || '');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/analytics/summary', { params: { days: 7 } }).then((r) => setStats(r.data)).catch(() => {});
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      await api.patch('/store/profile', { address, phone, description });
      await refresh();
      setMsg({ type: 'success', text: 'Store profile saved.' });
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="hero">
        <div>
          <h1>{user.store?.name || 'Your store'}</h1>
          <p>Welcome back, {user.name}. Here's how the store is doing.</p>
        </div>
        <span className="role-badge">Store Owner</span>
      </div>

      {stats && (
        <div className="kpi-grid">
          <div className="kpi accent"><span>Today's revenue</span><strong>{formatPHP(stats.today.revenue)}</strong><em>{stats.today.orders} orders</em></div>
          <div className={`kpi ${stats.totals.newOrders ? 'warn' : ''}`}><span>New orders</span><strong>{stats.totals.newOrders}</strong><em>{stats.totals.activeOrders} in progress</em></div>
          <div className="kpi"><span>Last 7 days</span><strong>{formatPHP(stats.period.revenue)}</strong><em>{stats.period.orders} orders</em></div>
          <div className={`kpi ${stats.inventory.lowStock.length + stats.inventory.outOfStock ? 'danger' : ''}`}>
            <span>Needs restock</span><strong>{stats.inventory.lowStock.length + stats.inventory.outOfStock}</strong>
            <em>{stats.inventory.outOfStock} out of stock</em>
          </div>
        </div>
      )}

      <div className="feature-grid big">
        <Link to="/store-orders" className="feature-card clickable">Orders<span>Accept & update deliveries</span></Link>
        <Link to="/inventory" className="feature-card clickable">Inventory & Sales<span>Products, stock, promos</span></Link>
        <Link to="/analytics" className="feature-card clickable">Analytics<span>Revenue & top products</span></Link>
        <Link to="/employees" className="feature-card clickable">Employees<span>Add & assign roles</span></Link>
        <div className="feature-card">Riders<span>Coming soon</span></div>
      </div>

      <form className="panel" onSubmit={saveProfile}>
        <h3>Store profile</h3>
        <p className="muted small">This is what customers see when they browse stores.</p>
        {msg.text && <div className={`message ${msg.type}`}>{msg.text}</div>}
        <div className="form-grid">
          <div className="field"><label>Address</label><input maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="field"><label>Phone</label><input maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field span2"><label>Short description</label><input maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <button className="btn-solid" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
      </form>
    </>
  );
}
