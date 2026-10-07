import { useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { errMsg } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import { SkeletonRows } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';

export default function ManageRiders() {
  usePageTitle('Riders');
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/riders');
      setRiders(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load riders.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/riders', { name, email, password });
      setName('');
      setEmail('');
      setPassword('');
      toast('Rider added.');
      load();
    } catch (err) {
      setFormError(errMsg(err, 'Could not add rider.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id) {
    const ok = await confirmDialog('Any deliveries currently assigned to them will be unassigned.', {
      title: 'Remove this rider?',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.delete(`/riders/${id}`);
      toast('Rider removed.');
      load();
    } catch (err) {
      toast(errMsg(err, 'Could not remove rider.'), { type: 'error' });
    }
  }

  return (
    <AppShell>
      <h1 className="page-title">Riders</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        Add riders so you can hand off deliveries. Once assigned, a rider marks their own delivery Out for Delivery
        and Delivered — you don't have to.
      </p>

      {error && <div className="message error">{error}</div>}

      <form onSubmit={handleAdd} className="panel">
        <h3>Add a rider</h3>
        {formError && <div className="message error">{formError}</div>}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="riderName">Full name</label>
            <input id="riderName" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="riderEmail">Email</label>
            <input id="riderEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="riderPassword">Password</label>
            <input
              id="riderPassword"
              type="password"
              required
              minLength={8}
              title="At least 8 characters with a letter and a number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="btn-solid" disabled={submitting}>
          {submitting && <Spinner light />}{submitting ? 'Adding...' : 'Add Rider'}
        </button>
      </form>

      <div className="panel flush">
        {loading ? (
          <div style={{ padding: 16 }}><SkeletonRows count={3} /></div>
        ) : riders.length === 0 ? (
          <p className="empty">No riders yet. Add your first one above.</p>
        ) : (
          <div className="row-list" style={{ padding: 16 }}>
            {riders.map((r) => (
              <div key={r.id} className={`row-item ${r.banned ? 'banned' : ''}`}>
                <div>
                  <strong>{r.name}</strong>
                  {r.banned && <span className="status-pill cancelled">banned by admin</span>}
                  <div className="muted small">{r.email}</div>
                  {r.banned && r.banReason && <div className="small text-danger">Reason: {r.banReason}</div>}
                </div>
                <button className="btn-danger-outline small" onClick={() => handleRemove(r.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
