import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, MapPin, Calendar, Users, ChevronDown, ChevronUp, User } from 'lucide-react';
import { Link } from 'react-router-dom';

function formatToPar(score) {
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreColor(score) {
  if (score < 0) return 'text-[#C96A52] font-bold';
  if (score > 0) return 'text-[#1D2D44]';
  return 'text-[#4A5D23] font-bold';
}

// Score indicator: colored circle for each hole
function HoleIndicator({ strokes, par }) {
  if (!strokes || strokes === 0) return <span className="text-[#D6D7D2]">-</span>;
  const diff = strokes - par;
  // Eagle or better (-2 or less)
  if (diff <= -2) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-white text-xs font-bold" title={`Eagle: ${strokes}`}>
      {strokes}
    </span>
  );
  // Birdie (-1)
  if (diff === -1) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#C96A52] text-white text-xs font-bold" title={`Birdie: ${strokes}`}>
      {strokes}
    </span>
  );
  // Par (0)
  if (diff === 0) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-[#4A5D23] text-[#4A5D23] text-xs font-bold" title={`Par: ${strokes}`}>
      {strokes}
    </span>
  );
  // Bogey (+1)
  if (diff === 1) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1D2D44] text-white text-xs font-bold" title={`Bogey: ${strokes}`}>
      {strokes}
    </span>
  );
  // Double bogey+ (+2 or more)
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#1D2D44] text-white text-xs font-bold ring-2 ring-[#1D2D44]/30" title={`+${diff}: ${strokes}`}>
      {strokes}
    </span>
  );
}

function PlayerAvatar({ name, picture }) {
  if (picture) {
    return <img src={picture} alt={name} className="w-8 h-8 rounded-full object-cover border border-[#E2E3DD]" />;
  }
  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-[#1B3C35] flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

export default function PublicLeaderboard() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [selectedId, setSelectedId] = useState(tournamentId || '');
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState(null);

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
    setExpandedPlayer(null);
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

  const toggleExpand = (userId) => {
    setExpandedPlayer(prev => prev === userId ? null : userId);
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

          {/* Score Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-4 px-1">
            <span className="text-xs text-[#6B6E66] font-bold uppercase tracking-wider">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-400 inline-block" />
              <span className="text-xs text-[#6B6E66]">Eagle</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#C96A52] inline-block" />
              <span className="text-xs text-[#6B6E66]">Birdie</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full border-2 border-[#4A5D23] inline-block" />
              <span className="text-xs text-[#6B6E66]">Par</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#1D2D44] inline-block" />
              <span className="text-xs text-[#6B6E66]">Bogey+</span>
            </div>
          </div>

          {/* Leaderboard */}
          <Card className="border-[#E2E3DD] shadow-none overflow-hidden">
            <CardHeader className="py-4 bg-[#1B3C35]">
              <CardTitle className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Standings
                <span className="ml-auto text-[10px] font-normal opacity-60">Tap player to see holes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard.length === 0 ? (
                <div className="py-12 text-center text-[#6B6E66]">
                  <p className="text-sm">No scores submitted yet.</p>
                </div>
              ) : (
                <div>
                  {/* Header */}
                  <div className="grid grid-cols-[3rem_1fr_4rem_4rem_3rem] sm:grid-cols-[3rem_1fr_5rem_5rem_4rem_repeat(var(--rounds),4rem)] items-center px-3 py-2.5 bg-[#E8E9E3]/50 border-b border-[#E2E3DD] text-xs font-bold text-[#1B3C35] uppercase tracking-wider"
                    style={{ '--rounds': leaderboard[0]?.rounds?.length > 1 ? leaderboard[0].rounds.length : 0 }}>
                    <span className="text-center">Pos</span>
                    <span>Player</span>
                    <span className="text-center">{isStableford ? 'Pts' : 'To Par'}</span>
                    <span className="text-center hidden sm:block">Total</span>
                    <span className="text-center">Thru</span>
                  </div>

                  {/* Rows */}
                  {leaderboard.map((entry, i) => {
                    const isExpanded = expandedPlayer === entry.user_id;
                    const sortedRounds = [...(entry.rounds || [])].sort((a, b) => a.round_number - b.round_number);

                    return (
                      <div key={entry.user_id} data-testid={`leaderboard-row-${i}`}>
                        {/* Main row */}
                        <div
                          className={`grid grid-cols-[3rem_1fr_4rem_4rem_3rem] sm:grid-cols-[3rem_1fr_5rem_5rem_4rem] items-center px-3 py-3 border-b border-[#E2E3DD] cursor-pointer transition-colors ${isExpanded ? 'bg-[#E8E9E3]/40' : 'hover:bg-[#E8E9E3]/20'} ${i === 0 ? 'bg-amber-50/30' : ''}`}
                          onClick={() => toggleExpand(entry.user_id)}
                          data-testid={`player-row-click-${i}`}
                        >
                          {/* Position */}
                          <span className="text-center font-bold tabular-nums text-[#1B3C35]">
                            {entry.tied ? 'T' : ''}{entry.position}
                          </span>

                          {/* Player name + avatar */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PlayerAvatar name={entry.player_name} picture={entry.picture} />
                            <div className="min-w-0">
                              <Link to={`/player/${entry.user_id}`}
                                className="font-semibold text-[#1B3C35] hover:text-[#C96A52] transition-colors truncate block"
                                onClick={e => e.stopPropagation()} data-testid={`player-link-${entry.user_id}`}>
                                {entry.player_name}
                              </Link>
                              {/* Round scores inline on desktop */}
                              {sortedRounds.length > 1 && (
                                <div className="hidden sm:flex gap-2 mt-0.5">
                                  {sortedRounds.map(r => (
                                    <span key={r.round_number} className="text-[10px] text-[#6B6E66] tabular-nums">
                                      R{r.round_number}: {r.strokes}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-[#6B6E66] shrink-0 ml-auto" /> :
                              <ChevronDown className="h-4 w-4 text-[#6B6E66] shrink-0 ml-auto" />}
                          </div>

                          {/* Score */}
                          <span className={`text-center tabular-nums text-lg ${isStableford ? 'font-bold text-[#1B3C35]' : scoreColor(entry.total_to_par)}`}>
                            {isStableford ? entry.stableford_points : formatToPar(entry.total_to_par)}
                          </span>

                          {/* Total strokes */}
                          <span className="text-center tabular-nums text-[#6B6E66] hidden sm:block">
                            {entry.total_strokes}
                          </span>

                          {/* Thru */}
                          <span className="text-center text-[#6B6E66] tabular-nums text-sm">
                            {entry.thru}
                          </span>
                        </div>

                        {/* Expanded hole-by-hole detail */}
                        {isExpanded && (
                          <div className="bg-[#F4F4F0] border-b border-[#E2E3DD] px-3 py-4 fade-in" data-testid={`expanded-detail-${i}`}>
                            {sortedRounds.map(round => (
                              <div key={round.round_number} className="mb-4 last:mb-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-bold text-[#1B3C35] uppercase tracking-wider">
                                    Round {round.round_number}
                                  </span>
                                  <span className={`text-xs font-bold tabular-nums ${scoreColor(round.to_par)}`}>
                                    {formatToPar(round.to_par)}
                                  </span>
                                  <span className="text-xs text-[#6B6E66] tabular-nums">({round.strokes})</span>
                                </div>

                                {/* Front 9 */}
                                <div className="overflow-x-auto">
                                  <div className="flex gap-1 min-w-max mb-1">
                                    <span className="w-8 text-[9px] text-[#6B6E66] font-bold text-center shrink-0">Hole</span>
                                    {round.holes?.slice(0, 9).map(h => (
                                      <span key={h.hole} className="w-8 text-[10px] text-[#6B6E66] font-bold text-center">{h.hole}</span>
                                    ))}
                                    <span className="w-8 text-[10px] text-[#1B3C35] font-bold text-center bg-[#E8E9E3] rounded">OUT</span>
                                  </div>
                                  <div className="flex gap-1 min-w-max mb-1">
                                    <span className="w-8 text-[9px] text-[#6B6E66] text-center shrink-0">Par</span>
                                    {round.holes?.slice(0, 9).map(h => (
                                      <span key={h.hole} className="w-8 text-[10px] text-[#6B6E66] text-center tabular-nums">{h.par}</span>
                                    ))}
                                    <span className="w-8 text-[10px] text-[#6B6E66] font-bold text-center bg-[#E8E9E3] rounded tabular-nums">
                                      {round.holes?.slice(0, 9).reduce((s, h) => s + h.par, 0)}
                                    </span>
                                  </div>
                                  <div className="flex gap-1 min-w-max">
                                    <span className="w-8 text-[9px] text-[#6B6E66] text-center shrink-0">Score</span>
                                    {round.holes?.slice(0, 9).map(h => (
                                      <span key={h.hole} className="w-8 flex justify-center">
                                        <HoleIndicator strokes={h.strokes} par={h.par} />
                                      </span>
                                    ))}
                                    <span className="w-8 text-xs font-bold text-[#1B3C35] text-center bg-[#E8E9E3] rounded tabular-nums flex items-center justify-center">
                                      {round.holes?.slice(0, 9).filter(h => h.strokes > 0).reduce((s, h) => s + h.strokes, 0) || '-'}
                                    </span>
                                  </div>
                                </div>

                                {/* Back 9 */}
                                {round.holes?.length > 9 && (
                                  <div className="overflow-x-auto mt-2">
                                    <div className="flex gap-1 min-w-max mb-1">
                                      <span className="w-8 text-[9px] text-[#6B6E66] font-bold text-center shrink-0">Hole</span>
                                      {round.holes?.slice(9).map(h => (
                                        <span key={h.hole} className="w-8 text-[10px] text-[#6B6E66] font-bold text-center">{h.hole}</span>
                                      ))}
                                      <span className="w-8 text-[10px] text-[#1B3C35] font-bold text-center bg-[#E8E9E3] rounded">IN</span>
                                    </div>
                                    <div className="flex gap-1 min-w-max mb-1">
                                      <span className="w-8 text-[9px] text-[#6B6E66] text-center shrink-0">Par</span>
                                      {round.holes?.slice(9).map(h => (
                                        <span key={h.hole} className="w-8 text-[10px] text-[#6B6E66] text-center tabular-nums">{h.par}</span>
                                      ))}
                                      <span className="w-8 text-[10px] text-[#6B6E66] font-bold text-center bg-[#E8E9E3] rounded tabular-nums">
                                        {round.holes?.slice(9).reduce((s, h) => s + h.par, 0)}
                                      </span>
                                    </div>
                                    <div className="flex gap-1 min-w-max">
                                      <span className="w-8 text-[9px] text-[#6B6E66] text-center shrink-0">Score</span>
                                      {round.holes?.slice(9).map(h => (
                                        <span key={h.hole} className="w-8 flex justify-center">
                                          <HoleIndicator strokes={h.strokes} par={h.par} />
                                        </span>
                                      ))}
                                      <span className="w-8 text-xs font-bold text-[#1B3C35] text-center bg-[#E8E9E3] rounded tabular-nums flex items-center justify-center">
                                        {round.holes?.slice(9).filter(h => h.strokes > 0).reduce((s, h) => s + h.strokes, 0) || '-'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
