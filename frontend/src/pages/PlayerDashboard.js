import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, ClipboardList, Target, Calendar, Users, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

function formatToPar(score) {
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreColorClass(score) {
  if (score < 0) return 'text-[#C96A52]';
  if (score > 0) return 'text-[#1D2D44]';
  return 'text-[#4A5D23]';
}

export default function PlayerDashboard() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [tRes, sRes, rRes] = await Promise.all([
        axios.get(`${API}/tournaments`),
        axios.get(`${API}/scorecards/my`),
        axios.get(`${API}/registrations/my`)
      ]);
      setTournaments(tRes.data);
      setScorecards(sRes.data);
      setMyRegistrations(rRes.data);
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
        <div className="animate-pulse text-[#1B3C35]">Loading dashboard...</div>
      </div>
    );
  }

  const activeTournaments = tournaments.filter(t => t.status === 'active' || t.status === 'upcoming');
  const myTournamentIds = new Set(scorecards.map(s => s.tournament_id));
  const totalRounds = scorecards.length;
  const submitted = scorecards.filter(s => s.status === 'submitted');
  const avgScore = submitted.length > 0
    ? Math.round(submitted.reduce((sum, s) => sum + s.total_to_par, 0) / submitted.length)
    : 0;

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto fade-in" data-testid="player-dashboard">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
          Welcome, {user?.name}
        </h1>
        <p className="text-[#6B6E66] mt-1">Here's your golf overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#1B3C35]/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-[#1B3C35]" />
            </div>
            <div>
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">Rounds</p>
              <p className="text-2xl font-bold text-[#1B3C35] tabular-nums" data-testid="stat-rounds">{totalRounds}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#C96A52]/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-[#C96A52]" />
            </div>
            <div>
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">Avg to Par</p>
              <p className={`text-2xl font-bold tabular-nums ${scoreColorClass(avgScore)}`} data-testid="stat-avg">
                {formatToPar(avgScore)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#4A5D23]/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-[#4A5D23]" />
            </div>
            <div>
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">Tournaments</p>
              <p className="text-2xl font-bold text-[#1B3C35] tabular-nums" data-testid="stat-tournaments">
                {myTournamentIds.size}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#1D2D44]/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-[#1D2D44]" />
            </div>
            <div>
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">Registered</p>
              <p className="text-2xl font-bold text-[#1B3C35] tabular-nums" data-testid="stat-registered">
                {myRegistrations.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Tournaments */}
      <Card className="border-[#E2E3DD] shadow-none mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            Tournaments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTournaments.length === 0 ? (
            <p className="text-[#6B6E66] text-sm py-4">No tournaments available right now.</p>
          ) : (
            <div className="space-y-3">
              {activeTournaments.map(t => {
                const isRegistered = myRegistrations.includes(t.tournament_id);
                const hasScorecard = myTournamentIds.has(t.tournament_id);
                return (
                  <div key={t.tournament_id}
                    className="flex items-center justify-between p-4 rounded-lg border border-[#E2E3DD] hover:bg-[#E8E9E3]/50 transition-colors"
                    data-testid={`tournament-card-${t.tournament_id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-[#1B3C35]">{t.name}</h3>
                        <Badge className={t.status === 'active'
                          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100'}
                          variant="outline">{t.status}</Badge>
                        {isRegistered && <Badge className="bg-[#1B3C35]/10 text-[#1B3C35] border-[#1B3C35]/20 hover:bg-[#1B3C35]/10">Registered</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#6B6E66]">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{t.start_date}</span>
                        <span>{t.course_name}</span>
                        <Badge variant="outline" className="text-[10px] py-0 capitalize">{t.scoring_format}</Badge>
                        {(t.num_rounds || 1) > 1 && <Badge variant="outline" className="text-[10px] py-0">{t.num_rounds}R</Badge>}
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t.participant_count || 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-3 shrink-0">
                      {!isRegistered ? (
                        <Button size="sm" className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={() => handleRegister(t.tournament_id)}
                          data-testid={`register-btn-${t.tournament_id}`}>
                          <UserPlus className="h-3.5 w-3.5 mr-1" />Register
                        </Button>
                      ) : (
                        <>
                          {t.status === 'active' && (
                            <Link to={`/scorecard/${t.tournament_id}`} data-testid={`enter-score-btn-${t.tournament_id}`}>
                              <Button size="sm" className="bg-[#1B3C35] hover:bg-[#1B3C35]/90">
                                {hasScorecard ? 'Update Score' : 'Enter Score'}
                              </Button>
                            </Link>
                          )}
                          {!hasScorecard && (
                            <Button size="sm" variant="outline" className="border-red-200 text-red-500 hover:bg-red-50"
                              onClick={() => handleUnregister(t.tournament_id)} data-testid={`unregister-btn-${t.tournament_id}`}>
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Scores */}
      <Card className="border-[#E2E3DD] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            Recent Scorecards
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scorecards.length === 0 ? (
            <p className="text-[#6B6E66] text-sm py-4">No scorecards yet. Register for a tournament to start!</p>
          ) : (
            <div className="space-y-3">
              {scorecards.slice(0, 8).map(sc => {
                const tournament = tournaments.find(t => t.tournament_id === sc.tournament_id);
                return (
                  <div key={sc.scorecard_id}
                    className="flex items-center justify-between p-4 rounded-lg border border-[#E2E3DD]"
                    data-testid={`scorecard-row-${sc.scorecard_id}`}>
                    <div>
                      <h3 className="font-medium text-[#1B3C35]">{tournament?.name || 'Tournament'}</h3>
                      <p className="text-xs text-[#6B6E66] mt-1">
                        Round {sc.round_number} &middot; {sc.completed_holes || sc.holes?.filter(h => h.strokes > 0).length}/{sc.holes?.length} holes
                        &middot; <Badge variant="secondary" className="text-[10px] capitalize py-0">{sc.status}</Badge>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold tabular-nums ${scoreColorClass(sc.total_to_par)}`}>
                        {formatToPar(sc.total_to_par)}
                      </p>
                      <p className="text-xs text-[#6B6E66]">{sc.total_strokes} strokes</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
