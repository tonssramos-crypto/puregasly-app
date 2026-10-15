import axios from 'axios';
import { goTo } from '../utils/navigation';

// In dev the Vite proxy forwards /api to localhost:5000.
// In production (Render static site) set VITE_API_URL to e.g. https://your-api.onrender.com/api
const baseURL = import.meta.env.VITE_API_URL || '/api';

// Session design:
//  - The ACCESS token (15 min) is kept only in memory - never in localStorage -
//    so a script injected into the page cannot read it from storage.
//  - The REFRESH token lives in an httpOnly cookie the browser manages; no
//    JavaScript can read it. `withCredentials` makes the browser send it.
//  - localStorage holds only a harmless "a session probably exists" flag, so a
//    fresh page load knows whether to try a silent refresh.
let accessToken = null;
const SESSION_FLAG = 'pg_session';

export function getAccessToken() {
  return accessToken;
}
export function setAccessToken(token) {
  accessToken = token || null;
  if (token) localStorage.setItem(SESSION_FLAG, '1');
}
export function hasSessionHint() {
  return localStorage.getItem(SESSION_FLAG) === '1';
}
// Wipes everything session-related on this device (also anything left behind
// by older versions of the app that stored tokens in localStorage).
export function clearSession() {
  accessToken = null;
  ['pg_session', 'pg_token', 'pg_refresh', 'pg_user'].forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem('pg_delivery');
}

// The server already marks every response as never-cacheable, but some
// browsers/proxies still only look at the *request's* cache headers for
// GETs - sending these too closes that gap, so data a page just fetched
// can never be served stale from a cache instead of hitting the API.
const api = axios.create({ baseURL, headers: { 'Cache-Control': 'no-cache' }, withCredentials: true });

// A plain client with no interceptors, used only for the refresh call itself
// so a failed refresh can never recursively trigger another refresh attempt.
const rawApi = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Codes that mean "this account can't be used right now" -> sign out with a notice.
const FORCE_LOGOUT = ['ACCOUNT_BANNED', 'ACCOUNT_DELETED', 'STORE_PENDING', 'STORE_REJECTED', 'STORE_INACTIVE', 'ACCOUNT_LOCKED'];

// Only one refresh request in flight at a time - if several requests 401 at
// once, they all wait on the same promise instead of racing each other.
let refreshPromise = null;

// Exchanges the refresh cookie for a new access token. Resolves with { token, user }.
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = rawApi
      .post('/auth/refresh')
      .then((res) => {
        setAccessToken(res.data.token);
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.code;
    const url = err.config?.url || '';
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/refresh') || url.startsWith('/auth/register');
    const loggedIn = !!accessToken || hasSessionHint();

    // A plain expired access token - try a silent refresh once, then retry the request.
    if (status === 401 && loggedIn && !isAuthCall && !err.config._retried) {
      err.config._retried = true;
      try {
        const data = await refreshAccessToken();
        err.config.headers.Authorization = `Bearer ${data.token}`;
        return api(err.config);
      } catch {
        clearSession();
        goTo('/login', { replace: true });
        return Promise.reject(err);
      }
    }

    if (!isAuthCall && loggedIn) {
      if ((status === 403 && FORCE_LOGOUT.includes(code)) || status === 423) {
        clearSession();
        sessionStorage.setItem('pg_notice', err.response.data.message);
        goTo('/login', { replace: true });
      } else if (status === 403 && code === 'STORE_NOT_ACTIVE') {
        // Store status changed while logged in (e.g. banned). Re-sync the user.
        window.dispatchEvent(new Event('pg:refresh-user'));
      } else if (status === 401) {
        // Refresh already failed above, or there was never a session.
        clearSession();
        goTo('/login', { replace: true });
      }
    }
    return Promise.reject(err);
  }
);

export default api;
