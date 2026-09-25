import axios from 'axios';

// In dev the Vite proxy forwards /api to localhost:5000.
// In production (Render static site) set VITE_API_URL to e.g. https://your-api.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Codes that mean "this account can't be used right now" -> sign out with a notice.
const FORCE_LOGOUT = ['ACCOUNT_BANNED', 'STORE_PENDING', 'STORE_REJECTED', 'STORE_INACTIVE'];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.code;
    const isAuthCall = err.config?.url?.startsWith('/auth/login');

    if (!isAuthCall && localStorage.getItem('pg_token')) {
      if (status === 403 && FORCE_LOGOUT.includes(code)) {
        localStorage.removeItem('pg_token');
        localStorage.removeItem('pg_user');
        sessionStorage.setItem('pg_notice', err.response.data.message);
        window.location.assign('/login');
      } else if (status === 403 && code === 'STORE_NOT_ACTIVE') {
        // Store status changed while logged in (e.g. banned). Re-sync the user.
        window.dispatchEvent(new Event('pg:refresh-user'));
      } else if (status === 401) {
        localStorage.removeItem('pg_token');
        localStorage.removeItem('pg_user');
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
