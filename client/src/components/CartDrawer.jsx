import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { errMsg, formatPHP } from '../utils/format';

export default function CartDrawer() {
  const { cart, setQty, clear, total, open, setOpen } = useCart();
  const navigate = useNavigate();

  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem('pg_delivery')) || {};
    } catch {
      return {};
    }
  })();

  const [address, setAddress] = useState(saved.address || '');
  const [phone, setPhone] = useState(saved.phone || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function placeOrder(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/orders', {
        items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        deliveryAddress: address,
        contactNumber: phone,
        notes,
      });
      localStorage.setItem('pg_delivery', JSON.stringify({ address, phone }));
      clear();
      setNotes('');
      setOpen(false);
      navigate('/orders');
    } catch (err) {
      setError(errMsg(err, 'Could not place the order.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={() => setOpen(false)}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>Your Cart</h3>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close cart">
            ✕
          </button>
        </div>

        {cart.items.length === 0 ? (
          <p className="muted center pad">Your cart is empty. Browse stores and add some LPG!</p>
        ) : (
          <form onSubmit={placeOrder} className="drawer-body">
            <p className="muted small">
              Ordering from <strong>{cart.store?.name}</strong>
            </p>

            <div className="cart-lines">
              {cart.items.map((i) => (
                <div key={i.productId} className="cart-line">
                  <div>
                    <strong>{i.name}</strong>
                    <span className="muted small">
                      {[i.brand, i.sizeKg ? `${i.sizeKg} kg` : null].filter(Boolean).join(' · ')}
                    </span>
                    <span className="small">{formatPHP(i.price)} each</span>
                  </div>
                  <div className="qty">
                    <button type="button" onClick={() => setQty(i.productId, i.qty - 1)}>
                      −
                    </button>
                    <span>{i.qty}</span>
                    <button type="button" onClick={() => setQty(i.productId, i.qty + 1)} disabled={i.qty >= i.stock}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-total">
              <span>Total</span>
              <strong>{formatPHP(total)}</strong>
            </div>

            <div className="field">
              <label htmlFor="addr">Delivery address</label>
              <textarea id="addr" rows={2} required maxLength={250} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">Contact number</label>
              <input id="phone" type="tel" required maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="notes">Notes for the store (optional)</label>
              <input id="notes" type="text" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <p className="muted small">Payment: Cash on Delivery</p>
            {error && <div className="message error">{error}</div>}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Placing order...' : `Place Order · ${formatPHP(total)}`}
            </button>
            <button type="button" className="btn-ghost full" onClick={clear}>
              Clear cart
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
