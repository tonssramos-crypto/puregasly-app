import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { clearSession, hasSessionHint, refreshAccessToken, setAccessToken } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // The profile is NOT persisted to localStorage any more (it contains the
  // person's name and e-mail). It is rebuilt from the server on every page load.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
    return res.data;
  }, []);

  // On page load: if this browser had a session, quietly trade the httpOnly
  // refresh cookie for a fresh access token + profile.
  useEffect(() => {
    if (!hasSessionHint()) {
      setLoading(false);
      return;
    }
    refreshAccessToken()
      .then((data) => setUser(data.user))
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fired by the axios interceptor when the store's status changed mid-session.
  useEffect(() => {
    const handler = () => refresh().catch(() => {});
    window.addEventListener('pg:refresh-user', handler);
    return () => window.removeEventListener('pg:refresh-user', handler);
  }, [refresh]);

  function login(token, userData) {
    setAccessToken(token);
    setUser(userData);
  }

  function logout() {
    // Revoke the session server-side (the cookie identifies it) - best effort,
    // never block logging out on it.
    api.post('/auth/logout').catch(() => {});
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
