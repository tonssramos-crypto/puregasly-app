import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import usePageTitle from '../utils/usePageTitle';
import Spinner from '../components/Spinner';
import AuthVisual from '../components/AuthVisual';

export default function Register() {
  usePageTitle('Register');
  const navigate = useNavigate();

  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/auth/register', { name, email, password, role, storeName });
      navigate('/login', {
        state: {
          status: res.data.pendingApproval
            ? 'Application submitted! An admin must approve your store before you can log in.'
            : 'Account created! You can now log in.',
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthVisual />

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="brand brand-mobile">
            <img src="/assets/logo.png" alt="PureGasly logo" />
            <span>PureGasly</span>
          </div>

          <h1 className="auth-heading">Create your account</h1>
          <p className="subtitle">Join PureGasly as a customer or store owner</p>

          {error && <div className="message error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="role-toggle">
              <label className={role === 'customer' ? 'active' : ''}>
                <input
                  type="radio"
                  name="role"
                  value="customer"
                  checked={role === 'customer'}
                  onChange={() => setRole('customer')}
                />
                <span>Customer</span>
              </label>
              <label className={role === 'owner' ? 'active' : ''}>
                <input
                  type="radio"
                  name="role"
                  value="owner"
                  checked={role === 'owner'}
                  onChange={() => setRole('owner')}
                />
                <span>Store Owner</span>
              </label>
            </div>

            <div className="field">
              <label htmlFor="name">Full Name</label>
              <div className="field-icon-wrap">
                <span className="field-icon">👤</span>
                <input
                  type="text"
                  id="name"
                  required
                  minLength={4}
                  placeholder="e.g. Juan Dela Cruz"
                  title="Enter your first and last name (letters only)"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {role === 'owner' && (
              <div className="field">
                <label htmlFor="storeName">Store Name</label>
                <div className="field-icon-wrap">
                  <span className="field-icon">🏪</span>
                  <input
                    type="text"
                    id="storeName"
                    required
                    placeholder="e.g. Dela Cruz LPG Depot"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {role === 'owner' && (
              <p className="muted small auth-note">
                Store accounts need admin approval before you can log in.
              </p>
            )}

            <div className="field">
              <label htmlFor="email">Email</label>
              <div className="field-icon-wrap">
                <span className="field-icon">✉️</span>
                <input
                  type="email"
                  id="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="field-icon-wrap">
                  <span className="field-icon">🔒</span>
                  <input
                    type="password"
                    id="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="field-icon-wrap">
                  <span className="field-icon">🔒</span>
                  <input
                    type="password"
                    id="confirmPassword"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting && <Spinner light />}{submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="switch-link">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
