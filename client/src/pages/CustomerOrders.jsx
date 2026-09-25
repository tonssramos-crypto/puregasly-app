import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import OrderTracker from '../components/OrderTracker';
import { errMsg, formatDateTime, formatPHP, STATUS_LABELS } from '../utils/format';

const FILTERS = [
  { key: 'active', label: 'Active', match: (o) => ['pending', 'preparing', 'out_for_delivery', 'delivered'].includes(o.status) },
  { key: 'done', label: 'Completed', match: (o) => o.status === 'received' },
  { key: 'cancelled', label: 'Cancelled', match: (o) => o.status === 'cancelled' },
];

export default function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/orders/mine');
      setOrders(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load your orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // pick up status changes from the store
    return () => clearInterval(t);
  }, [load]);

  async function act(id, action, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(id);
    try {
      await api.patch(`/orders/${id}/${action}`);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  const current = FILTERS.find((f) => f.key === filter);
  const shown = orders.filter(current.match);

  return (
    <AppShell>
      <h1 className="page-title">My Orders</h1>

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
            {f.label} ({orders.filter(f.match).length})
          </button>
        ))}
      </div>

      {error && <div className="message error">{error}</div>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : shown.length === 0 ? (
        <p className="empty">Nothing here yet.</p>
      ) : (
        <div className="order-list">
          {shown.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-head">
                <div>
                  <strong>{o.orderNo}</strong>
                  <span className="muted small"> · {o.storeName}</span>
                  <div className="muted small">{formatDateTime(o.createdAt)}</div>
                </div>
                <strong className="price">{formatPHP(o.total)}</strong>
              </div>

              <OrderTracker status={o.status} />

              <ul className="order-items">
                {o.items.map((it, i) => (
                  <li key={i}>
                    <span>
                      {it.qty} × {it.name}
                      {it.sizeKg ? ` (${it.sizeKg} kg)` : ''}
                    </span>
                    <span>{formatPHP(it.qty * it.unitPrice)}</span>
                  </li>
                ))}
              </ul>
              <p className="muted small">📍 {o.deliveryAddress}</p>

              <div className="order-actions">
                <span className={`status-pill ${o.status}`}>{o.status === 'pending' ? 'Waiting for store' : STATUS_LABELS[o.status]}</span>
                {o.status === 'pending' && (
                  <button className="btn-danger small" disabled={busyId === o.id} onClick={() => act(o.id, 'cancel', 'Cancel this order?')}>
                    Cancel Order
                  </button>
                )}
                {o.status === 'delivered' && (
                  <button className="btn-solid" disabled={busyId === o.id} onClick={() => act(o.id, 'received')}>
                    ORDER RECEIVED
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
