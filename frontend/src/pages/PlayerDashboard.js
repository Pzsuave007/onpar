import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Calendar, Users, UserPlus, UserMinus, CirclePlay, Radio, Camera, ChevronRight, Flame, Flag } from 'lucide-react';
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
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [tRes, sRes, rRes, rnRes] = await Promise.all([
        axios.get(`${API}/tournaments`),
        axios.get(`${API}/scorecards/my`),
        axios.get(`${API}/registrations/my`),
        axios.get(`${API}/rounds/my`).catch(() => ({ data: [] }))
      ]);
      setTournaments(tRes.data);
      setScorecards(sRes.data);
      setMyRegistrations(rRes.data);
      setRounds(rnRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRegister = async (tournamentId) => {
    try {
      await axios.post(`${API}/tournaments/${tournamentId}/register`);
      toast.success('Registered!');
      setMyRegistrations(prev => [...prev, tournamentId]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    }
  };

  const handleUnregister = async (tournamentId) => {
    try {
      await axios.delete(`${API}/tournaments/${tournamentId}/unregister`);
      toast.success('Unregistered');
      setMyRegistrations(prev => prev.filter(id => id !== tournamentId));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot unregister');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading...</div>
      </div>
    );
  }

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const submitted = scorecards.filter(s => s.status === 'submitted');
  const totalRounds = submitted.length + rounds.filter(r => r.status === 'completed').length;
  const avgScore = submitted.length > 0
    ? Math.round(submitted.reduce((sum, s) => sum + s.total_to_par, 0) / submitted.length)
    : 0;
  const bestScore = submitted.length > 0
    ? Math.min(...submitted.map(s => s.total_to_par))
    : null;

  // Last round (from casual rounds or scorecards)
  const lastRound = rounds[0] || null;
  const lastScorecard = scorecards[0] || null;

  // Find birdies from rounds
  const recentBirdies = [];
  for (const r of rounds.slice(0, 5)) {
    for (const h of (r.holes || [])) {
      if (h.strokes > 0 && h.strokes < h.par) {
        recentBirdies.push({
          course: r.course_name,
          hole: h.hole,
          par: h.par,
          strokes: h.strokes,
          diff: h.strokes - h.par
        });
      }
    }
  }
  // Also from scorecards
  for (const sc of scorecards.slice(0, 5)) {
    const t = tournaments.find(t => t.tournament_id === sc.tournament_id);
    for (const h of (sc.holes || [])) {
      if (h.strokes > 0 && h.strokes < h.par) {
        recentBirdies.push({
          course: t?.course_name || 'Tournament',
          hole: h.hole,
          par: h.par,
          strokes: h.strokes,
          diff: h.strokes - h.par
        });
      }
    }
  }
  const topBirdies = recentBirdies.sort((a, b) => a.diff - b.diff).slice(0, 5);

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto fade-in" data-testid="player-dashboard">

      {/* Greeting */}
      <div className="mb-5">
        <p className="text-sm text-[#6B6E66]">Welcome back</p>
        <h1 className="text-2xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
          {user?.name}
        </h1>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link to="/play" data-testid="quick-play">
          <div className="bg-[#C96A52] rounded-xl p-4 text-white active:scale-[0.98] transition-transform">
            <CirclePlay className="h-6 w-6 mb-2" />
            <p className="text-sm font-bold">Play a Round</p>
          </div>
        </Link>
        {activeTournaments.length > 0 && user?.role === 'admin' ? (
          <Link to={`/keeper/${activeTournaments[0].tournament_id}`} data-testid="quick-scorer">
            <div className="bg-[#1B3C35] rounded-xl p-4 text-white active:scale-[0.98] transition-transform">
              <Radio className="h-6 w-6 mb-2" />
              <p className="text-sm font-bold">Live Scorer</p>
            </div>
          </Link>
        ) : (
          <Link to="/challenges" data-testid="quick-challenges">
            <div className="bg-[#1B3C35] rounded-xl p-4 text-white active:scale-[0.98] transition-transform">
              <Target className="h-6 w-6 mb-2" />
              <p className="text-sm font-bold">Challenges</p>
            </div>
          </Link>
        )}
      </div>

      {/* Compact Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-white rounded-xl border border-[#E2E3DD] p-3 text-center">
          <p className="text-xl font-bold text-[#1B3C35] tabular-nums" data-testid="stat-rounds">{totalRounds}</p>
          <p className="text-[10px] text-[#6B6E66] font-bold uppercase">Rounds</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E3DD] p-3 text-center">
          <p className={`text-xl font-bold tabular-nums ${scoreClr(avgScore)}`} data-testid="stat-avg">
            {submitted.length > 0 ? formatToPar(avgScore) : '–'}
          </p>
          <p className="text-[10px] text-[#6B6E66] font-bold uppercase">Avg Score</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E3DD] p-3 text-center">
          <p className={`text-xl font-bold tabular-nums ${bestScore !== null ? scoreClr(bestScore) : 'text-[#6B6E66]'}`} data-testid="stat-best">
            {bestScore !== null ? formatToPar(bestScore) : '–'}
          </p>
          <p className="text-[10px] text-[#6B6E66] font-bold uppercase">Best</p>
        </div>
      </div>

      {/* Last Round */}
      {(lastRound || lastScorecard) && (
        <div className="mb-5">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">Last Round</p>
          <Card className="border-[#E2E3DD] shadow-none overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-[#1B3C35] px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">{lastRound?.course_name || tournaments.find(t => t.tournament_id === lastScorecard?.tournament_id)?.course_name || 'Course'}</p>
                  <p className="text-white/60 text-xs">{new Date(lastRound?.created_at || lastScorecard?.created_at || '').toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold tabular-nums ${lastRound ? (lastRound.total_to_par < 0 ? 'text-[#C96A52]' : lastRound.total_to_par > 0 ? 'text-red-300' : 'text-[#4A5D23]') : scoreClr(lastScorecard.total_to_par)} text-white`}>
                    {formatToPar(lastRound?.total_to_par ?? lastScorecard?.total_to_par ?? 0)}
                  </p>
                  <p className="text-white/60 text-xs tabular-nums">{lastRound?.total_strokes || lastScorecard?.total_strokes} strokes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Tournaments */}
      {activeTournaments.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">Active Tournaments</p>
          <div className="space-y-2">
            {activeTournaments.map(t => {
              const isRegistered = myRegistrations.includes(t.tournament_id);
              return (
                <Card key={t.tournament_id} className="border-[#E2E3DD] shadow-none"
                  data-testid={`tournament-card-${t.tournament_id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[#1B3C35] truncate">{t.name}</p>
                        <p className="text-xs text-[#6B6E66]">{t.course_name} &middot; {t.participant_count || 0} players</p>
                      </div>
                      {!isRegistered ? (
                        <Button size="sm" className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 shrink-0 h-9"
                          onClick={() => handleRegister(t.tournament_id)}>
                          <UserPlus className="h-3.5 w-3.5 mr-1" />Join
                        </Button>
                      ) : (
                        <div className="flex gap-1.5 shrink-0">
                          {user?.role === 'admin' && (
                            <Link to={`/keeper/${t.tournament_id}`}>
                              <Button size="sm" className="bg-[#C96A52] hover:bg-[#C96A52]/90 h-9">
                                <Radio className="h-3.5 w-3.5 mr-1" />Score
                              </Button>
                            </Link>
                          )}
                          <Link to={`/leaderboard/${t.tournament_id}`}>
                            <Button size="sm" variant="outline" className="border-[#E2E3DD] h-9">
                              <Trophy className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Birdies */}
      {topBirdies.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">
            <Flame className="h-3.5 w-3.5 inline mr-1 text-[#C96A52]" />Best Holes
          </p>
          <div className="space-y-1.5">
            {topBirdies.map((b, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg border border-[#E2E3DD] px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${b.diff <= -2 ? 'bg-amber-400' : 'bg-[#C96A52]'}`}>
                    {b.strokes}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#1B3C35]">Hole {b.hole}</p>
                    <p className="text-[10px] text-[#6B6E66]">{b.course} &middot; Par {b.par}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-[#C96A52]">
                  {b.diff <= -2 ? 'Eagle' : 'Birdie'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Tournaments */}
      {tournaments.filter(t => t.status === 'upcoming').length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">Upcoming</p>
          <div className="space-y-2">
            {tournaments.filter(t => t.status === 'upcoming').map(t => {
              const isRegistered = myRegistrations.includes(t.tournament_id);
              return (
                <div key={t.tournament_id}
                  className="flex items-center justify-between bg-white rounded-lg border border-[#E2E3DD] px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B3C35] truncate">{t.name}</p>
                    <p className="text-[10px] text-[#6B6E66]"><Calendar className="h-3 w-3 inline mr-0.5" />{t.start_date}</p>
                  </div>
                  {!isRegistered ? (
                    <Button size="sm" variant="outline" className="border-[#E2E3DD] h-8 text-xs shrink-0"
                      onClick={() => handleRegister(t.tournament_id)}>
                      Register
                    </Button>
                  ) : (
                    <Badge className="bg-[#4A5D23]/10 text-[#4A5D23] border-[#4A5D23]/20 hover:bg-[#4A5D23]/10 text-[10px]">Registered</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
