// 1v1 Quick Match detail / live comparison page
// Shows: status, both players' running totals, accept/decline (if pending),
// and a Resume/Start button that takes you into the round.
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

export default function Match1v1Detail() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchMatch = useCallback(() => {
    return axios.get(`${API}/matches/1v1/${matchId}`)
      .then(r => setMatch(r.data))
      .catch(() => setMatch(null));
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
    const t = setInterval(fetchMatch, 30000); // poll every 30s for live opponent score
    return () => clearInterval(t);
  }, [fetchMatch]);

  if (!match) {
    return <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#1B3C35]" />
    </div>;
  }

  const isP1 = user?.user_id === match.player1_id;
  const me = isP1 ? match.p1_card : match.p2_card;
  const opp = isP1 ? match.p2_card : match.p1_card;
  const myName = isP1 ? match.player1_name : match.player2_name;
  const oppName = isP1 ? match.player2_name : match.player1_name;
  const isOpponentInvited = !isP1 && match.status === 'pending';

  const respond = async (action) => {
    setBusy(true);
    try {
      await axios.post(`${API}/matches/1v1/${matchId}/respond`, { action });
      toast.success(action === 'accept' ? 'Match accepted! 🥊' : 'Match declined');
      await fetchMatch();
      if (action === 'accept') {
        navigate(`/play/${match.course_id}?match=${matchId}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to respond');
    } finally {
      setBusy(false);
    }
  };

  const PlayerCol = ({ label, name, card, highlight }) => (
    <div className={`flex-1 text-center py-4 px-3 rounded-xl ${highlight ? 'bg-[#C96A52]/10 border-2 border-[#C96A52]/30' : 'bg-[#E8E9E3]/40'}`}>
      <p className="text-[10px] uppercase tracking-wider text-[#6B6E66] font-bold">{label}</p>
      <p className="font-bold text-[#1B3C35] truncate text-base mt-0.5">{name}</p>
      <p className="text-4xl font-bold text-[#1B3C35] tabular-nums mt-2 leading-none" style={{ fontFamily: 'Outfit' }}>
        {card?.total_strokes ?? '–'}
      </p>
      <p className="text-xs text-[#6B6E66] mt-1">
        <ToParBadge score={card?.total_to_par} />
        <span className="mx-1">·</span>
        thru {card?.completed_holes ?? 0}
      </p>
      {card?.status === 'submitted' && (
        <Badge className="mt-2 bg-[#4A5D23] hover:bg-[#4A5D23] text-white text-[10px]">
          <Check className="h-3 w-3 mr-0.5" /> Done
        </Badge>
      )}
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto fade-in" data-testid="match-1v1-page">
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
          </div>
          <h1 className="text-2xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            {match.player1_name} <span className="text-[#C96A52]">vs</span> {match.player2_name}
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
                {match.result.winner_id === user?.user_id ? <span><b>You won!</b> 🏆</span> :
                 match.result.winner_id ? <span><b>{match.result.winner_name}</b> won</span> :
                 <span><b>Tie</b></span>}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live scoreboard */}
      <div className="flex items-stretch gap-2 mb-4">
        <PlayerCol label="You" name={myName} card={me} highlight />
        <div className="self-center text-[#C96A52] font-bold text-xl">vs</div>
        <PlayerCol label="Opponent" name={oppName} card={opp} />
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        {isOpponentInvited && (
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
        {match.status === 'active' && me?.status !== 'submitted' && (
          <Link to={`/play/${match.course_id}?match=${matchId}`} data-testid="match-play-btn">
            <Button className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12">
              <Flag className="h-4 w-4 mr-1" />
              {me?.completed_holes ? 'Continue Round' : 'Start Round'}
            </Button>
          </Link>
        )}
        {match.status === 'completed' && (
          <Link to={`/leaderboard/${matchId}`} data-testid="match-leaderboard-btn">
            <Button variant="outline" className="w-full border-[#E2E3DD]">
              <Trophy className="h-4 w-4 mr-1" /> View Leaderboard
            </Button>
          </Link>
        )}
        {match.status === 'declined' && (
          <p className="text-center text-sm text-[#6B6E66]">
            <UserIcon className="h-4 w-4 inline" /> {match.player2_name} declined this challenge
          </p>
        )}
      </div>
    </div>
  );
}
