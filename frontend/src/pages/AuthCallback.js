import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { setUser, setLoading } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const sessionId = params.get('session_id');

    if (!sessionId) {
      navigate('/login', { replace: true });
      return;
    }

    axios.get(`${API}/auth/session`, {
      headers: { 'X-Session-ID': sessionId },
      withCredentials: true
    }).then(res => {
      setUser(res.data);
      setLoading(false);
      window.history.replaceState(null, '', '/dashboard');
      navigate('/dashboard', { replace: true });
    }).catch(() => {
      navigate('/login', { replace: true });
    });
  }, [navigate, setUser, setLoading]);

  return null;
}
