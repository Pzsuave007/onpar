import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Calendar, CirclePlay, Camera, ChevronRight, Flame, MapPin, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

function formatToPar(score) {
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreClr(s) {
  if (s < 0) return 'text-[#C96A52]';
  if (s > 0) return 'text-[#1D2D44]';
  return 'text-[#4A5D23]';
}

export default function PlayerDashboard() {
  const { user, setUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [myPhotos, setMyPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef(null);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/profile/stats`).catch(() => ({ data: null })),
      axios.get(`${API}/tournaments`).catch(() => ({ data: [] })),
      axios.get(`${API}/registrations/my`).catch(() => ({ data: [] })),
      axios.get(`${API}/profile/photos?limit=6`).catch(() => ({ data: [] }))
    ]).then(([sRes, tRes, rRes, pRes]) => {
      setStats(sRes.data);
      setTournaments(tRes.data);
      setMyRegistrations(rRes.data);
      setMyPhotos(pRes.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only images'); return; }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/profile/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Update user context with new picture
      if (setUser && user) setUser({ ...user, picture: res.data.picture });
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-[#1B3C35] animate-spin" />
      </div>
    );
  }

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming');
  const initials = (user?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto" data-testid="player-dashboard">

      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <input type="file" accept="image/*" ref={avatarRef} onChange={handleAvatarUpload} className="hidden" />
          <button onClick={() => avatarRef.current?.click()}
            className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#E2E3DD] active:scale-95 transition-transform"
            data-testid="avatar-btn">
            {uploadingAvatar ? (
              <div className="w-full h-full bg-[#E8E9E3] flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-[#6B6E66] animate-spin" />
              </div>
            ) : user?.picture ? (
              <img src={user.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#1B3C35] flex items-center justify-center text-white text-xl font-bold">
                {initials}
              </div>
            )}
          </button>
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#C96A52] rounded-full flex items-center justify-center">
            <Camera className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>{user?.name}</h1>
          <p className="text-xs text-[#6B6E66]">{user?.email}</p>
          {stats?.handicap !== null && stats?.handicap !== undefined && (
            <Badge className="mt-1 bg-[#1B3C35] text-white hover:bg-[#1B3C35] text-xs">
              HCP {stats.handicap}
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link to="/play" data-testid="quick-play">
          <div className="bg-[#C96A52] rounded-xl p-4 text-white active:scale-[0.98] transition-transform">
            <CirclePlay className="h-6 w-6 mb-2" />
            <p className="text-sm font-bold">Play a Round</p>
          </div>
        </Link>
        <Link to="/challenges" data-testid="quick-challenges">
          <div className="bg-[#1B3C35] rounded-xl p-4 text-white active:scale-[0.98] transition-transform">
            <Target className="h-6 w-6 mb-2" />
            <p className="text-sm font-bold">Challenges</p>
          </div>
        </Link>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="bg-white rounded-xl border border-[#E2E3DD] p-2.5 text-center">
            <p className="text-lg font-bold text-[#1B3C35] tabular-nums">{stats.total_rounds}</p>
            <p className="text-[9px] text-[#6B6E66] font-bold uppercase">Rounds</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E3DD] p-2.5 text-center">
            <p className={`text-lg font-bold tabular-nums ${scoreClr(stats.avg_to_par)}`}>
              {stats.total_rounds > 0 ? formatToPar(stats.avg_to_par) : '–'}
            </p>
            <p className="text-[9px] text-[#6B6E66] font-bold uppercase">Avg</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E3DD] p-2.5 text-center">
            <p className="text-lg font-bold text-[#C96A52] tabular-nums">{stats.total_birdies}</p>
            <p className="text-[9px] text-[#6B6E66] font-bold uppercase">Birdies</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E3DD] p-2.5 text-center">
            <p className="text-lg font-bold text-amber-500 tabular-nums">{stats.total_eagles}</p>
            <p className="text-[9px] text-[#6B6E66] font-bold uppercase">Eagles</p>
          </div>
        </div>
      )}

      {/* Active Tournaments */}
      {activeTournaments.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">
            <Trophy className="h-3.5 w-3.5 inline mr-1" />Active Tournaments
          </p>
          <div className="space-y-2">
            {activeTournaments.map(t => (
              <Link key={t.tournament_id} to={`/leaderboard/${t.tournament_id}`}>
                <Card className="border-[#E2E3DD] shadow-none hover:border-[#1B3C35]/30 transition-colors mb-2">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#1B3C35] truncate">{t.name}</p>
                      <p className="text-xs text-[#6B6E66]">{t.course_name}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#6B6E66] shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* My Challenges */}
      {stats?.challenges?.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">
            <Target className="h-3.5 w-3.5 inline mr-1" />My Challenges
          </p>
          <div className="space-y-2">
            {stats.challenges.map(ch => {
              const pct = ch.total_holes > 0 ? Math.round((ch.completed_holes / ch.total_holes) * 100) : 0;
              return (
                <Link key={ch.challenge_id} to={`/challenges/${ch.challenge_id}`}>
                  <Card className="border-[#E2E3DD] shadow-none hover:border-[#1B3C35]/30 transition-colors mb-2">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-bold text-sm text-[#1B3C35] truncate">{ch.name}</p>
                        <span className="text-xs font-bold text-[#C96A52] tabular-nums shrink-0">{ch.completed_holes}/{ch.total_holes}</span>
                      </div>
                      <div className="h-2 bg-[#E8E9E3] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#C96A52' }} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Rounds */}
      {stats?.recent_rounds?.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider">
              <Flame className="h-3.5 w-3.5 inline mr-1 text-[#C96A52]" />Recent Rounds
            </p>
            <Link to="/history" className="text-[11px] font-bold text-[#C96A52] hover:text-[#1B3C35]"
              data-testid="view-all-rounds-link">
              View All →
            </Link>
          </div>
          <div className="space-y-1.5">
            {stats.recent_rounds.map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg border border-[#E2E3DD] px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B3C35] truncate">{r.course || 'Tournament Round'}</p>
                  <p className="text-[10px] text-[#6B6E66]">
                    <Calendar className="h-3 w-3 inline mr-0.5" />
                    {r.date ? new Date(r.date).toLocaleDateString() : ''}
                    {r.strokes ? ` • ${r.strokes} strokes` : ''}
                  </p>
                </div>
                <span className={`text-lg font-bold tabular-nums ${scoreClr(r.to_par)}`}>
                  {formatToPar(r.to_par)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Tournaments */}
      {upcomingTournaments.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">
            <Calendar className="h-3.5 w-3.5 inline mr-1" />Upcoming
          </p>
          <div className="space-y-1.5">
            {upcomingTournaments.map(t => (
              <div key={t.tournament_id} className="flex items-center justify-between bg-white rounded-lg border border-[#E2E3DD] px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B3C35] truncate">{t.name}</p>
                  <p className="text-[10px] text-[#6B6E66]">{t.start_date} • {t.course_name}</p>
                </div>
                <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 text-[10px]">
                  {myRegistrations.includes(t.tournament_id) ? 'Joined' : 'Open'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Photos (recent shared photos across tournaments + challenges) */}
      {myPhotos.length > 0 && (
        <div className="mb-5" data-testid="dashboard-photos">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">
            <Camera className="h-3.5 w-3.5 inline mr-1" />My Photos
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {myPhotos.map(p => {
              const href = p.scope_type === 'challenge'
                ? `/challenges/${p.scope_id}`
                : `/leaderboard/${p.scope_id}`;
              return (
                <Link key={p.photo_id} to={href}
                  className="relative aspect-square rounded-lg overflow-hidden bg-[#E8E9E3] group"
                  data-testid={`dashboard-photo-${p.photo_id}`}>
                  {p.url_path ? (
                    <img src={p.url_path} alt={p.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <Camera className="h-6 w-6 text-[#6B6E66]" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                    <p className="text-[9px] text-white font-medium truncate">
                      {p.scope_type === 'challenge' ? (p.challenge_name || 'Challenge') : 'Tournament'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats?.total_rounds === 0 && activeTournaments.length === 0 && (
        <div className="text-center py-12">
          <User className="h-10 w-10 text-[#D6D7D2] mx-auto mb-3" />
          <p className="text-sm text-[#6B6E66]">No rounds yet. Start playing to see your stats!</p>
        </div>
      )}
    </div>
  );
}
