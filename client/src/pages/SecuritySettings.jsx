import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAccessToken } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import { errMsg, formatDateTime } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import { SkeletonRows } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';

function parseDevice(ua) {
  if (!ua) return 'Unknown device';
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android device';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh|mac os/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux PC';
  return 'Unknown device';
}

function parseBrowser(ua) {
  if (!ua) return '';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome\//i.test(ua)) return 'Chrome';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  return '';
}

export default function SecuritySettings() {
  usePageTitle('Security');
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');

  // privacy: export + delete
  const [exporting, setExporting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/auth/sessions');
      setSessions(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load your sessions.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(id) {
    setBusyId(id);
    try {
      await api.delete(`/auth/sessions/${id}`);
      toast('Device logged out.');
      await load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function logoutAll() {
    const ok = await confirmDialog('This will log out every device, including this one.', {
      title: 'Log out everywhere?',
      confirmLabel: 'Log out everywhere',
    });
    if (!ok) return;
    setLoggingOutAll(true);
    try {
      await api.post('/auth/logout-all');
    } catch {
      // continue anyway - we're about to clear the local session regardless
    }
    logout();
    navigate('/login', { replace: true });
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError('');
    if (newPassword !== confirmNew) {
      setPwError('The new passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      setAccessToken(res.data.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNew('');
      toast('Password updated. Your other devices were signed out.');
      await load();
    } catch (err) {
      setPwError(errMsg(err, 'Could not change your password.'));
    } finally {
      setPwBusy(false);
    }
  }

  async function downloadData() {
    setExporting(true);
    try {
      const res = await api.get('/auth/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'puregasly-my-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(errMsg(err, 'Could not export your data.'), { type: 'error' });
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setDeleteError('');
    const ok = await confirmDialog(
      'Your account and personal data will be permanently erased. This cannot be undone.',
      { title: 'Delete your account?', confirmLabel: 'Delete my account' }
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete('/auth/account', { data: { password: deletePassword } });
      localStorage.removeItem(`pg_cart_${user?.id}`);
      logout();
      navigate('/login', { replace: true, state: { status: 'Your account has been deleted.' } });
    } catch (err) {
      setDeleteError(errMsg(err, 'Could not delete your account.'));
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <h1 className="page-title">Security</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        These are the devices currently signed in to your account. If you don't recognize one, log it out.
      </p>

      {error && <div className="message error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h3>Active sessions</h3>
          <button className="btn-danger-outline small" onClick={logoutAll} disabled={loggingOutAll}>
            {loggingOutAll ? 'Logging out...' : 'Log out everywhere'}
          </button>
        </div>

        {loading ? (
          <SkeletonRows count={2} />
        ) : sessions.length === 0 ? (
          <p className="empty">No active sessions found.</p>
        ) : (
          <div className="row-list">
            {sessions.map((s) => (
              <div key={s.id} className="row-item">
                <div>
                  <strong>
                    {parseDevice(s.userAgent)}
                    {parseBrowser(s.userAgent) ? ` · ${parseBrowser(s.userAgent)}` : ''}
                  </strong>
                  {s.current && <span className="status-pill received">this device</span>}
                  <div className="muted small">Signed in {formatDateTime(s.createdAt)}</div>
                </div>
                {!s.current && (
                  <button className="btn-danger-outline small" disabled={busyId === s.id} onClick={() => revoke(s.id)}>
                    {busyId === s.id && <Spinner />}Log out
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Change password</h3>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Changing your password signs out every other device. Use at least 10 characters with a letter and a number.
        </p>
        {pwError && <div className="message error">{pwError}</div>}
        <form onSubmit={changePassword} className="security-form">
          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <input
              type="password"
              id="currentPassword"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <input
                type="password"
                id="newPassword"
                required
                minLength={10}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="confirmNew">Confirm new password</label>
              <input
                type="password"
                id="confirmNew"
                required
                minLength={10}
                autoComplete="new-password"
                value={confirmNew}
                onChange={(e) => setConfirmNew(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary security-submit" disabled={pwBusy}>
            {pwBusy && <Spinner light />}{pwBusy ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>Your data</h3>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Download a copy of the personal information we hold about you (account, addresses, orders, reviews and more).
          See our <Link to="/privacy">Privacy Policy</Link> for how it is used and how long it is kept.
        </p>
        <button className="btn-ghost small" onClick={downloadData} disabled={exporting}>
          {exporting && <Spinner />}{exporting ? 'Preparing...' : 'Download my data'}
        </button>
      </div>

      {user?.role === 'customer' && (
        <div className="panel">
          <h3>Delete account</h3>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Permanently erases your saved addresses, favorites, notifications and the delivery details on your past
            orders, and anonymises your account. You can only do this when you have no order in progress.
          </p>
          {deleteError && <div className="message error">{deleteError}</div>}
          <form onSubmit={deleteAccount} className="security-form">
            <div className="field">
              <label htmlFor="deletePassword">Confirm with your password</label>
              <input
                type="password"
                id="deletePassword"
                required
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-danger-outline" disabled={deleting || !deletePassword}>
              {deleting && <Spinner />}{deleting ? 'Deleting...' : 'Delete my account'}
            </button>
          </form>
        </div>
      )}
    </AppShell>
  );
}
