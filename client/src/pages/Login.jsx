import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../utils/usePageTitle';
import Spinner from '../components/Spinner';

export default function Login() {
  usePageTitle('Log In');
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const statusMessage = location.state?.status;
  const [notice] = useState(() => {
    const n = sessionStorage.getItem('pg_notice');
    sessionStorage.removeItem('pg_notice');
    return n || '';
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.refreshToken, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <img src="/assets/logo.png" alt="PureGasly logo" />
          <span>PureGasly</span>
        </div>
        <p className="subtitle">Log in to your account</p>

        {statusMessage && <div className="message success">{statusMessage}</div>}
        {notice && <div className="message error">{notice}</div>}
        {error && <div className="message error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting && <Spinner light />}{submitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="switch-link">
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
