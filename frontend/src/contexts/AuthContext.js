import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set up axios interceptor once
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(config => {
      const token = localStorage.getItem('fairway_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      config.withCredentials = true;
      return config;
    });
    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  const checkAuth = useCallback(async () => {
    // CRITICAL: Skip if returning from OAuth callback
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch {
      setUser(null);
      localStorage.removeItem('fairway_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem('fairway_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, password, name) => {
    const res = await axios.post(`${API}/auth/register`, { email, password, name });
    localStorage.setItem('fairway_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch {}
    localStorage.removeItem('fairway_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, setLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { API };
