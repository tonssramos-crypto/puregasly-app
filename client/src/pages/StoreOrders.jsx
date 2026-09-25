import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import OrderTracker from '../components/OrderTracker';
import { errMsg, formatDateTime, formatPHP, STATUS_LABELS } from '../utils/format';

const TABS = ['pending', 'preparing', 'out_for_delivery', 'delivered', 'received', 'cancelled'];

// What the store's next button says for each status.
const ACTION_LABEL = {
  pending: 'Accept · Start Preparing',
  preparing: 'Out for Delivery',
  out_for_delivery: 'Mark as Delivered',
};

export default function StoreOrders() {
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/store-orders');
      setOrders(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // new orders show up on their own
    return () => clearInterval(t);
  }, [load]);

  async function act(id, action) {
    setBusyId(id);
    try {
      await api.patch(`/store-orders/${id}/${action}`);
      await load();
    } catch (err) {
      setError(errMsg(err));
      load();
    } finally {
      setBusyId(null);
    }
  }

  const counts = TABS.reduce((acc, t) => ({ ...acc, [t]: orders.filter((o) => o.status === t).length }), {});
  const shown = orders.filter((o) => o.status === tab);

  return (
    <AppShell wide>
      <div className="page-head">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="muted small">Accept new orders, then move them along until they're delivered. Refreshes automatically.</p>
        </div>
        <button className="btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      <div className="tabs scroll">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {STATUS_LABELS[t]}
            {counts[t] > 0 && <span className={`tab-count ${t === 'pending' ? 'hot' : ''}`}>{counts[t]}</span>}
          </button>
        ))}
      </div>

      {error && <div className="message error">{error}</div>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : shown.length === 0 ? (
        <p className="empty">No {STATUS_LABELS[tab].toLowerCase()} orders.</p>
      ) : (
        <div className="order-list">
          {shown.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-head">
                <div>
                  <strong>{o.orderNo}</strong>
                  <span className="muted small"> · {formatDateTime(o.createdAt)}</span>
                  <div className="small">
                    👤 {o.customer?.name || 'Customer'} · 📞 {o.contactNumber}
                  </div>
                </div>
                <strong className="price">{formatPHP(o.total)}</strong>
              </div>

              <OrderTracker status={o.status} />

              <ul className="order-items">
                {o.items.map((it, i) => (
                  <li key={i}>
                    <span>
                      {it.qty} × {it.name}
                      {it.brand ? ` · ${it.brand}` : ''}
                      {it.sizeKg ? ` (${it.sizeKg} kg)` : ''}
                    </span>
                    <span>{formatPHP(it.qty * it.unitPrice)}</span>
                  </li>
                ))}
              </ul>
              <p className="small">📍 {o.deliveryAddress}</p>
              {o.notes && <p className="small muted">📝 {o.notes}</p>}
              <p className="muted small">Payment: Cash on Delivery</p>

              <div className="order-actions">
                {ACTION_LABEL[o.status] && (
                  <button className="btn-solid" disabled={busyId === o.id} onClick={() => act(o.id, 'advance')}>
                    {ACTION_LABEL[o.status]}
                  </button>
                )}
                {o.status === 'pending' && (
                  <button
                    className="btn-danger-outline"
                    disabled={busyId === o.id}
                    onClick={() => window.confirm('Decline this order?') && act(o.id, 'decline')}
                  >
                    Decline
                  </button>
                )}
                {o.status === 'delivered' && <span className="muted small">Waiting for the customer to confirm receipt.</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
