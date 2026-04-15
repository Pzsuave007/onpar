import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, ClipboardList, Target, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  upcoming: 'bg-blue-100 text-blue-700 border-blue-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
};

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, sRes] = await Promise.all([
          axios.get(`${API}/tournaments`),
          axios.get(`${API}/scorecards/my`)
        ]);
        setTournaments(tRes.data);
        setScorecards(sRes.data);
      } catch (err) {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading dashboard...</div>
      </div>
    );
  }

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const myTournamentIds = new Set(scorecards.map(s => s.tournament_id));
  const totalRounds = scorecards.length;
  const avgScore = scorecards.length > 0
    ? Math.round(scorecards.reduce((sum, s) => sum + s.total_to_par, 0) / scorecards.length)
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#1B3C35]/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-[#1B3C35]" />
            </div>
            <div>
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">Rounds Played</p>
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
      </div>

      {/* Active Tournaments */}
      <Card className="border-[#E2E3DD] shadow-none mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            Active Tournaments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTournaments.length === 0 ? (
            <p className="text-[#6B6E66] text-sm py-4">No active tournaments right now.</p>
          ) : (
            <div className="space-y-3">
              {activeTournaments.map(t => {
                const hasScorecard = myTournamentIds.has(t.tournament_id);
                return (
                  <div key={t.tournament_id}
                    className="flex items-center justify-between p-4 rounded-lg border border-[#E2E3DD] hover:bg-[#E8E9E3]/50 transition-colors"
                    data-testid={`tournament-card-${t.tournament_id}`}>
                    <div>
                      <h3 className="font-medium text-[#1B3C35]">{t.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#6B6E66]">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{t.start_date}</span>
                        <span>{t.course_name}</span>
                        <Badge variant="outline" className="text-[10px] py-0 capitalize">{t.scoring_format}</Badge>
                      </div>
                    </div>
                    <Link to={`/scorecard/${t.tournament_id}`} data-testid={`enter-score-btn-${t.tournament_id}`}>
                      <Button size="sm" className="bg-[#1B3C35] hover:bg-[#1B3C35]/90">
                        {hasScorecard ? 'Update Score' : 'Enter Score'}
                      </Button>
                    </Link>
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
            <p className="text-[#6B6E66] text-sm py-4">No scorecards yet. Join an active tournament to start!</p>
          ) : (
            <div className="space-y-3">
              {scorecards.slice(0, 5).map(sc => {
                const tournament = tournaments.find(t => t.tournament_id === sc.tournament_id);
                return (
                  <div key={sc.scorecard_id}
                    className="flex items-center justify-between p-4 rounded-lg border border-[#E2E3DD]"
                    data-testid={`scorecard-row-${sc.scorecard_id}`}>
                    <div>
                      <h3 className="font-medium text-[#1B3C35]">{tournament?.name || 'Tournament'}</h3>
                      <p className="text-xs text-[#6B6E66] mt-1">
                        Round {sc.round_number} &middot; {sc.completed_holes || sc.holes?.filter(h => h.strokes > 0).length}/{sc.holes?.length} holes
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
