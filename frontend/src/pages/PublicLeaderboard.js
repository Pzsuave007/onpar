import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, MapPin, Calendar, Users } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

function formatToPar(score) {
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreColor(score) {
  if (score < 0) return 'text-[#C96A52] font-bold';
  if (score > 0) return 'text-[#1D2D44]';
  return 'text-[#4A5D23] font-bold';
}

export default function PublicLeaderboard() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [selectedId, setSelectedId] = useState(tournamentId || '');
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/tournaments`).then(res => {
      const active = res.data.filter(t => t.status === 'active' || t.status === 'completed');
      setTournaments(active);
      if (!selectedId && active.length > 0) {
        setSelectedId(active[0].tournament_id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    axios.get(`${API}/leaderboard/${selectedId}`).then(res => {
      setLeaderboardData(res.data);
    }).catch(() => {
      setLeaderboardData(null);
    }).finally(() => setLoading(false));
  }, [selectedId]);

  const handleSelect = (val) => {
    setSelectedId(val);
    navigate(`/leaderboard/${val}`, { replace: true });
  };

  const tournament = leaderboardData?.tournament;
  const leaderboard = leaderboardData?.leaderboard || [];
  const isStableford = tournament?.scoring_format === 'stableford';

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto fade-in" data-testid="public-leaderboard">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">Live Standings</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            Leaderboard
          </h1>
        </div>
        {tournaments.length > 0 && (
          <Select value={selectedId} onValueChange={handleSelect}>
            <SelectTrigger className="w-full sm:w-72 border-[#E2E3DD] bg-white" data-testid="tournament-select">
              <SelectValue placeholder="Select tournament" />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map(t => (
                <SelectItem key={t.tournament_id} value={t.tournament_id} data-testid={`select-option-${t.tournament_id}`}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-pulse text-[#1B3C35]">Loading leaderboard...</div>
        </div>
      ) : !tournament ? (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="py-16 text-center">
            <Trophy className="h-12 w-12 text-[#D6D7D2] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#1B3C35] mb-2" style={{ fontFamily: 'Outfit' }}>No Tournament Selected</h3>
            <p className="text-sm text-[#6B6E66]">
              {tournaments.length === 0 ? 'No active tournaments at the moment.' : 'Select a tournament to view the leaderboard.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tournament Info */}
          <Card className="border-[#E2E3DD] shadow-none mb-6">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>
                    {tournament.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-[#6B6E66]">
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{tournament.course_name}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{tournament.start_date}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{tournament.participant_count || 0} players</span>
                    {(tournament.num_rounds || 1) > 1 && <span>{tournament.num_rounds} rounds</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="capitalize">{tournament.scoring_format}</Badge>
                  <Badge className={tournament.status === 'active'
                    ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'}>
                    {tournament.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard Table */}
          <Card className="border-[#E2E3DD] shadow-none overflow-hidden">
            <CardHeader className="py-4 bg-[#1B3C35]">
              <CardTitle className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Standings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard.length === 0 ? (
                <div className="py-12 text-center text-[#6B6E66]">
                  <p className="text-sm">No scores submitted yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#E8E9E3]/40 hover:bg-[#E8E9E3]/40">
                      <TableHead className="w-16 text-center font-bold text-[#1B3C35]">Pos</TableHead>
                      <TableHead className="font-bold text-[#1B3C35]">Player</TableHead>
                      <TableHead className="text-center font-bold text-[#1B3C35]">
                        {isStableford ? 'Points' : 'To Par'}
                      </TableHead>
                      {!isStableford && (
                        <TableHead className="text-center font-bold text-[#1B3C35] hidden sm:table-cell">Total</TableHead>
                      )}
                      <TableHead className="text-center font-bold text-[#1B3C35]">Thru</TableHead>
                      {leaderboard[0]?.rounds?.length > 1 && (
                        leaderboard[0].rounds.map((_, i) => (
                          <TableHead key={i} className="text-center font-bold text-[#1B3C35] hidden md:table-cell">
                            R{i + 1}
                          </TableHead>
                        ))
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((entry, i) => (
                      <TableRow key={entry.user_id} className="leaderboard-row hover:bg-[#E8E9E3]/30"
                        data-testid={`leaderboard-row-${i}`}>
                        <TableCell className="text-center font-bold tabular-nums text-[#1B3C35]">
                          {entry.tied ? 'T' : ''}{entry.position}
                        </TableCell>
                        <TableCell className="font-medium text-[#1B3C35]">
                          <RouterLink to={`/player/${entry.user_id}`} className="hover:underline hover:text-[#C96A52] transition-colors"
                            data-testid={`player-link-${entry.user_id}`}>
                            {entry.player_name}
                          </RouterLink>
                        </TableCell>
                        <TableCell className={`text-center tabular-nums text-lg ${isStableford ? 'font-bold text-[#1B3C35]' : scoreColor(entry.total_to_par)}`}>
                          {isStableford ? entry.stableford_points : formatToPar(entry.total_to_par)}
                        </TableCell>
                        {!isStableford && (
                          <TableCell className="text-center tabular-nums text-[#6B6E66] hidden sm:table-cell">
                            {entry.total_strokes}
                          </TableCell>
                        )}
                        <TableCell className="text-center text-[#6B6E66] tabular-nums">
                          {entry.thru}
                        </TableCell>
                        {entry.rounds?.length > 1 && (
                          entry.rounds.sort((a, b) => a.round_number - b.round_number).map((r, j) => (
                            <TableCell key={j} className="text-center tabular-nums text-[#6B6E66] hidden md:table-cell">
                              {r.strokes}
                            </TableCell>
                          ))
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
