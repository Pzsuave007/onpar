import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Trophy, Target, ClipboardList, TrendingDown, BarChart3, Swords } from 'lucide-react';

function formatToPar(score) {
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function scoreColor(score) {
  if (score < 0) return 'text-[#C96A52] font-bold';
  if (score > 0) return 'text-[#1D2D44]';
  return 'text-[#4A5D23] font-bold';
}

export default function PlayerProfile() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [h2h, setH2h] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/players/${userId}/profile`).then(res => {
      setProfile(res.data);
    }).catch(() => {
      setProfile(null);
    }).finally(() => setLoading(false));
  }, [userId]);

  // Fetch head-to-head only if the viewer is logged in and is NOT the profile owner
  useEffect(() => {
    if (!me || !userId || me.user_id === userId) return;
    axios.get(`${API}/profile/head-to-head/${userId}`)
      .then(res => setH2h(res.data))
      .catch(() => setH2h(null));
  }, [me, userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#6B6E66]">Player not found.</p>
      </div>
    );
  }

  const { player, stats, history } = profile;

  const statCards = [
    { icon: ClipboardList, label: 'Rounds Played', value: stats.total_rounds, color: '#1B3C35' },
    { icon: Trophy, label: 'Tournaments', value: stats.tournaments_played, color: '#4A5D23' },
    { icon: Target, label: 'Avg to Par', value: formatToPar(stats.avg_to_par), color: '#C96A52', scoreVal: stats.avg_to_par },
    { icon: TrendingDown, label: 'Best Round', value: formatToPar(stats.best_to_par), color: '#1B3C35', scoreVal: stats.best_to_par },
    { icon: BarChart3, label: 'Avg Strokes', value: stats.avg_strokes, color: '#1D2D44' },
    { icon: Target, label: 'Best Strokes', value: stats.best_strokes, color: '#4A5D23' },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto fade-in" data-testid="player-profile">
      {/* Player Header */}
      <Card className="border-[#E2E3DD] shadow-none mb-8">
        <CardContent className="p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-[#1B3C35] flex items-center justify-center shrink-0">
            {player.picture ? (
              <img src={player.picture} alt={player.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-white" />
            )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}
              data-testid="profile-name">
              {player.name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="secondary" className="capitalize">{player.role}</Badge>
              {player.handicap != null && (
                <span className="text-sm text-[#6B6E66]">Handicap: {player.handicap}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {statCards.map((s, i) => (
          <Card key={i} className="border-[#E2E3DD] shadow-none" data-testid={`profile-stat-${i}`}>
            <CardContent className="p-4 text-center">
              <s.icon className="h-5 w-5 mx-auto mb-2" style={{ color: s.color }} />
              <p className={`text-xl font-bold tabular-nums ${s.scoreVal !== undefined ? scoreColor(s.scoreVal) : `text-[${s.color}]`}`}>
                {s.value}
              </p>
              <p className="text-[10px] text-[#6B6E66] uppercase tracking-wider font-bold mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Head-to-head (only shown when viewing someone else's profile) */}
      {h2h && (h2h.stroke_wins + h2h.stroke_losses + h2h.stroke_ties + h2h.match_wins + h2h.match_losses) > 0 && (
        <Card className="border-[#E2E3DD] shadow-none mb-6" data-testid="h2h-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-[#1B3C35] flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
              <Swords className="h-5 w-5 text-[#C96A52]" /> Head-to-Head · You vs {h2h.opponent?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center py-3 rounded-lg bg-[#4A5D23]/10 border border-[#4A5D23]/20">
                <p className="text-3xl font-bold text-[#4A5D23] tabular-nums" style={{ fontFamily: 'Outfit' }}>
                  {h2h.stroke_wins + h2h.match_wins}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[#6B6E66] font-bold mt-1">Wins</p>
              </div>
              <div className="text-center py-3 rounded-lg bg-[#C96A52]/10 border border-[#C96A52]/20">
                <p className="text-3xl font-bold text-[#C96A52] tabular-nums" style={{ fontFamily: 'Outfit' }}>
                  {h2h.stroke_losses + h2h.match_losses}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[#6B6E66] font-bold mt-1">Losses</p>
              </div>
              <div className="text-center py-3 rounded-lg bg-[#6B6E66]/10 border border-[#6B6E66]/20">
                <p className="text-3xl font-bold text-[#6B6E66] tabular-nums" style={{ fontFamily: 'Outfit' }}>
                  {h2h.stroke_ties}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[#6B6E66] font-bold mt-1">Ties</p>
              </div>
            </div>
            {h2h.recent && h2h.recent.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#6B6E66] font-bold mb-2">Recent Matchups</p>
                <div className="space-y-1.5">
                  {h2h.recent.slice(0, 5).map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-[#E8E9E3]/40 rounded text-sm"
                      data-testid={`h2h-recent-${i}`}>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-[#1B3C35] truncate">{r.tournament_name}</span>
                        <span className="text-xs text-[#6B6E66] ml-2">
                          {r.format === 'match' ? 'Match Play' : `R${r.round_number}`}
                        </span>
                      </div>
                      {r.format === 'stroke' && (
                        <span className="text-xs text-[#6B6E66] mx-3 tabular-nums hidden sm:inline">
                          {r.my_strokes} vs {r.opp_strokes}
                        </span>
                      )}
                      <Badge className={
                        r.outcome === 'W' ? 'bg-[#4A5D23] hover:bg-[#4A5D23] text-white text-[10px]' :
                        r.outcome === 'L' ? 'bg-[#C96A52] hover:bg-[#C96A52] text-white text-[10px]' :
                        'bg-[#6B6E66] hover:bg-[#6B6E66] text-white text-[10px]'
                      }>
                        {r.outcome}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tournament History */}
      <Card className="border-[#E2E3DD] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            Tournament History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="py-8 text-center text-[#6B6E66] text-sm">No tournament history yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#E8E9E3]/40 hover:bg-[#E8E9E3]/40">
                  <TableHead className="font-bold text-[#1B3C35]">Tournament</TableHead>
                  <TableHead className="font-bold text-[#1B3C35] hidden sm:table-cell">Course</TableHead>
                  <TableHead className="text-center font-bold text-[#1B3C35]">Round</TableHead>
                  <TableHead className="text-center font-bold text-[#1B3C35]">To Par</TableHead>
                  <TableHead className="text-center font-bold text-[#1B3C35]">Strokes</TableHead>
                  <TableHead className="text-center font-bold text-[#1B3C35]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h, i) => (
                  <TableRow key={i} data-testid={`history-row-${i}`}>
                    <TableCell className="font-medium text-[#1B3C35]">{h.tournament_name}</TableCell>
                    <TableCell className="text-[#6B6E66] hidden sm:table-cell">{h.course_name}</TableCell>
                    <TableCell className="text-center tabular-nums text-[#6B6E66]">R{h.round_number}</TableCell>
                    <TableCell className={`text-center tabular-nums ${scoreColor(h.total_to_par)}`}>
                      {formatToPar(h.total_to_par)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-[#6B6E66]">{h.total_strokes}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={h.status === 'submitted' ? 'default' : 'secondary'} className="text-[10px] capitalize">
                        {h.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
