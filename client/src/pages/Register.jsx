import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import usePageTitle from '../utils/usePageTitle';
import Spinner from '../components/Spinner';
import AuthVisual from '../components/AuthVisual';
import DocumentUploads from '../components/DocumentUploads';
import { DOCUMENT_TYPES } from '../utils/documentTypes';

export default function Register() {
  usePageTitle('Register');
  const navigate = useNavigate();

  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [docs, setDocs] = useState({});
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
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

    if (!acceptedPrivacy) {
      setError('Please accept the Privacy Policy to continue.');
      return;
    }

    if (role === 'owner') {
      const missing = DOCUMENT_TYPES.find((d) => d.required && !docs[d.key]);
      if (missing) {
        setError(`Please upload: ${missing.label}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // multipart so the business documents can travel with the sign-up.
      const form = new FormData();
      form.append('name', name);
      form.append('email', email);
      form.append('password', password);
      form.append('role', role);
      form.append('acceptedPrivacy', 'true');
      if (role === 'owner') {
        form.append('storeName', storeName);
        Object.entries(docs).forEach(([key, file]) => form.append(key, file));
      }
      const res = await api.post('/auth/register', form);
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

            {role === 'owner' && <DocumentUploads files={docs} onChange={setDocs} onError={setError} />}

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

            <label className="consent">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
              />
              <span>
                I have read and agree to the{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </span>
            </label>

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
