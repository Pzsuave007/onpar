// Notification bell with unread badge + dropdown list.
// Polls /api/notifications every 60 seconds (lightweight, no websocket).
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/contexts/AuthContext';
import { Bell, Trophy, Check, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

const POLL_MS = 60_000;

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API}/notifications`);
      setItems(res.data.items || []);
      setUnread(res.data.unread_count || 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [user, load]);

  const handleClick = async (n) => {
    setOpen(false);
    if (!n.read) {
      axios.post(`${API}/notifications/${n.notification_id}/read`).catch(() => {});
      setItems(prev => prev.map(x => x.notification_id === n.notification_id ? { ...x, read: true } : x));
      setUnread(c => Math.max(0, c - 1));
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await axios.post(`${API}/notifications/mark-all-read`).catch(() => {});
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    setUnread(0);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) load(); }}>
      <PopoverTrigger asChild>
        <button
          className="relative w-9 h-9 rounded-full hover:bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35]"
          data-testid="notifications-bell">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C96A52] text-white text-[10px] font-bold flex items-center justify-center"
              data-testid="notifications-badge">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#E2E3DD]">
          <p className="text-sm font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>Notificaciones</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll}
              className="h-7 text-[11px] text-[#C96A52] hover:text-[#1B3C35]"
              data-testid="mark-all-read-btn">
              Marcar todas leídas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-10 w-10 text-[#D6D7D2] mx-auto mb-2" />
              <p className="text-sm text-[#6B6E66]">Sin notificaciones</p>
            </div>
          ) : (
            items.map(n => (
              <button key={n.notification_id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-3 py-3 border-b border-[#E2E3DD] last:border-0 hover:bg-[#E8E9E3]/40 flex gap-3 ${!n.read ? 'bg-[#C96A52]/5' : ''}`}
                data-testid={`notif-${n.notification_id}`}>
                <div className="w-8 h-8 rounded-full bg-[#1B3C35]/10 flex items-center justify-center shrink-0">
                  {n.type === 'tour_invite' ? <Trophy className="h-4 w-4 text-[#C96A52]" />
                    : <Bell className="h-4 w-4 text-[#1B3C35]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${!n.read ? 'font-bold text-[#1B3C35]' : 'text-[#6B6E66]'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-[#6B6E66] line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-[#D6D7D2] mt-0.5">
                    {new Date(n.created_at).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#C96A52] shrink-0 mt-2" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
