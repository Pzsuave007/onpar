// Match detail / live comparison page (multi-player friendly).
// Shows: status, players + their running totals, accept/decline (if I'm pending),
// teams (best_ball), and a Resume/Start button when active.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth, API } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Swords, Flag, Trophy, Check, X, Loader2, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

function ToParBadge({ score }) {
  if (score == null) return <span className="text-[#6B6E66]">—</span>;
  if (score === 0) return <span className="text-[#4A5D23] font-bold">E</span>;
  return <span className={`font-bold ${score < 0 ? 'text-[#C96A52]' : 'text-[#1D2D44]'}`}>
    {score > 0 ? `+${score}` : score}
  </span>;
}

const FORMAT_LABEL = {
  stroke: 'Stroke Play',
  match_play: 'Match Play',
  best_ball: 'Best Ball',
};

export default function MatchDetail() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchMatch = useCallback(() => {
    return axios.get(`${API}/matches/${matchId}`)
      .then(r => setMatch(r.data))
      .catch(() => setMatch(null));
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
    const t = setInterval(fetchMatch, 30000);
    return () => clearInterval(t);
  }, [fetchMatch]);

  if (!match) {
    return <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#1B3C35]" />
    </div>;
  }

  const me = (match.players || []).find(p => p.user_id === user?.user_id);
  const accepted = (match.players || []).filter(p => p.status === 'accepted');
  const isPendingForMe = me?.status === 'pending';
  const myCard = me?.card;
  const teamFor = (uid) => (match.teams || []).find(t => (t.user_ids || []).includes(uid));

  // Sort accepted players by lowest strokes (stroke play leaderboard)
  const acceptedSorted = [...accepted].sort((a, b) => {
    const sa = a.card?.total_strokes ?? 9999;
    const sb = b.card?.total_strokes ?? 9999;
    return sa - sb;
  });

  const respond = async (action) => {
    setBusy(true);
    try {
      await axios.post(`${API}/matches/${matchId}/respond`, { action });
      toast.success(action === 'accept' ? 'You\'re in! 🥊' : 'Match declined');
      await fetchMatch();
      if (action === 'accept') {
        navigate(`/play/${match.course_id}?match=${matchId}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to respond');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto fade-in" data-testid="match-page">
      <Button variant="ghost" className="mb-3 text-[#6B6E66]" onClick={() => navigate('/dashboard')}
        data-testid="match-detail-back">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Swords className="h-5 w-5 text-[#C96A52]" />
            <Badge className={
              match.status === 'active' ? 'bg-[#4A5D23] hover:bg-[#4A5D23] text-white' :
              match.status === 'pending' ? 'bg-[#C96A52] hover:bg-[#C96A52] text-white' :
              match.status === 'completed' ? 'bg-[#1D2D44] hover:bg-[#1D2D44] text-white' :
              'bg-[#6B6E66] hover:bg-[#6B6E66] text-white'
            }>
              {match.status?.toUpperCase()}
            </Badge>
            <Badge className="bg-white border border-[#E2E3DD] text-[#6B6E66] hover:bg-white">
              {FORMAT_LABEL[match.format] || match.format}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            {match.name}
          </h1>
          <p className="text-sm text-[#6B6E66] mt-1">
            {match.course_name} · {match.tee_name} tees · {match.num_holes || 18} holes
          </p>

          {/* Result banner */}
          {match.result && (
            <div className="mt-4 p-3 rounded-lg bg-[#4A5D23]/10 border border-[#4A5D23]/30 text-center"
              data-testid="match-result-banner">
              <Trophy className="h-6 w-6 text-[#4A5D23] mx-auto mb-1" />
              <p className="text-sm text-[#1B3C35]">
                {match.result.winner_id === user?.user_id
                  ? <span><b>You won!</b> 🏆</span>
                  : match.result.winner_team && teamFor(user?.user_id)?.team === match.result.winner_team
                    ? <span><b>Your team won!</b> 🏆 ({match.result.score})</span>
                    : match.result.winner_id || match.result.winner_team
                      ? <span><b>{match.result.winner_name}</b> won{match.result.score ? ` (${match.result.score})` : ''}</span>
                      : <span><b>Tie</b>{match.result.score ? ` (${match.result.score})` : ''}</span>}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      {acceptedSorted.length > 0 && (
        <Card className="border-[#E2E3DD] shadow-none mb-4">
          <CardContent className="p-3">
            <p className="text-xs uppercase tracking-wider text-[#6B6E66] font-bold mb-2 px-1">Leaderboard</p>
            <div className="divide-y divide-[#E2E3DD]">
              {acceptedSorted.map((p, idx) => {
                const c = p.card;
                const team = teamFor(p.user_id);
                const isMe = p.user_id === user?.user_id;
                return (
                  <div key={p.user_id} className={`flex items-center gap-3 py-2.5 px-1 ${isMe ? 'bg-[#C96A52]/5' : ''}`}
                    data-testid={`leaderboard-row-${p.user_id}`}>
                    <span className="text-base font-bold text-[#6B6E66] w-5 tabular-nums">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#1B3C35] truncate">
                        {p.name}{isMe && <span className="ml-1 text-[10px] text-[#6B6E66] uppercase">you</span>}
                      </p>
                      <p className="text-[11px] text-[#6B6E66]">
                        {team && <span className="mr-2">{team.name || `Team ${team.team}`}</span>}
                        thru {c?.completed_holes ?? 0}
                        {c?.status === 'submitted' && <span className="ml-2 text-[#4A5D23]">· Done</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#1B3C35] tabular-nums leading-none" style={{ fontFamily: 'Outfit' }}>
                        {c?.total_strokes ?? '–'}
                      </p>
                      <p className="text-xs"><ToParBadge score={c?.total_to_par} /></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending invitees */}
      {(match.players || []).some(p => p.status === 'pending') && (
        <Card className="border-[#E2E3DD] shadow-none mb-4">
          <CardContent className="p-3">
            <p className="text-xs uppercase tracking-wider text-[#6B6E66] font-bold mb-2 px-1">Awaiting</p>
            <div className="space-y-1">
              {(match.players || []).filter(p => p.status === 'pending').map(p => (
                <div key={p.user_id} className="flex items-center gap-2 py-1 px-1 text-sm text-[#6B6E66]">
                  <UserIcon className="h-4 w-4" /> {p.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        {isPendingForMe && (
          <div className="flex gap-2">
            <Button onClick={() => respond('decline')} disabled={busy}
              variant="outline" className="flex-1 border-[#C96A52] text-[#C96A52] hover:bg-[#C96A52]/10 h-12"
              data-testid="match-decline-btn">
              <X className="h-4 w-4 mr-1" /> Decline
            </Button>
            <Button onClick={() => respond('accept')} disabled={busy}
              className="flex-1 bg-[#4A5D23] hover:bg-[#4A5D23]/90 h-12"
              data-testid="match-accept-btn">
              <Check className="h-4 w-4 mr-1" /> Accept
            </Button>
          </div>
        )}
        {match.status === 'active' && me?.status === 'accepted' && myCard?.status !== 'submitted' && (
          <Link to={`/play/${match.course_id}?match=${matchId}`} data-testid="match-play-btn">
            <Button className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12">
              <Flag className="h-4 w-4 mr-1" />
              {myCard?.completed_holes ? 'Continue Round' : 'Start Round'}
            </Button>
          </Link>
        )}
        {match.status === 'completed' && (
          <Link to={`/leaderboard/${matchId}`} data-testid="match-leaderboard-btn">
            <Button variant="outline" className="w-full border-[#E2E3DD]">
              <Trophy className="h-4 w-4 mr-1" /> View Final Scorecard
            </Button>
          </Link>
        )}
        {match.status === 'cancelled' && (
          <p className="text-center text-sm text-[#6B6E66]">Match cancelled — everyone declined.</p>
        )}
      </div>
    </div>
  );
}
