// Match Play bracket view — admin generates bracket, everyone can view progress.
// Participants submit per-hole strokes via /tournament/:id/bracket by picking their active match.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Shuffle, Trophy, Crown, Share2 } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';

function PlayerChip({ player, isWinner }) {
  if (!player) {
    return <div className="flex items-center gap-2 text-[#6B6E66] italic text-sm">— Bye —</div>;
  }
  return (
    <div className={`flex items-center gap-2 ${isWinner ? 'font-bold text-[#1B3C35]' : 'text-[#1B3C35]'}`}>
      <PlayerAvatar user={player} size={24} />
      <span className="truncate text-sm">{player.name}</span>
      {isWinner && <Crown className="h-3.5 w-3.5 text-[#C96A52]" />}
    </div>
  );
}

function MatchCard({ match, onOpen, myId }) {
  const statusColor = match.status === 'completed' ? 'bg-[#4A5D23]/10 text-[#4A5D23]' :
    match.status === 'in_progress' ? 'bg-[#C96A52]/10 text-[#C96A52]' : 'bg-[#E2E3DD] text-[#6B6E66]';
  const canPlay = !match.is_bye && match.status !== 'completed' && (
    myId && (myId === match.player1_id || myId === match.player2_id)
  );
  const w = match.winner_id;
  return (
    <Card className="border-[#E2E3DD] shadow-none hover:shadow-md transition-shadow"
      data-testid={`match-card-${match.match_id}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Badge className={`${statusColor} text-[10px] hover:${statusColor}`}>
            {match.is_bye ? 'BYE' : match.status.toUpperCase()}
          </Badge>
          {match.player1_points > 0 || match.player2_points > 0 ? (
            <span className="text-[11px] text-[#6B6E66] font-mono">
              {match.player1_points} - {match.player2_points}
            </span>
          ) : null}
        </div>
        <PlayerChip player={match.player1} isWinner={w && w === match.player1_id} />
        <div className="h-px bg-[#E2E3DD]" />
        <PlayerChip player={match.player2} isWinner={w && w === match.player2_id} />
        {canPlay && (
          <Button size="sm" className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-8 text-xs mt-1"
            onClick={() => onOpen(match)} data-testid={`enter-score-${match.match_id}`}>
            Enter Scores
          </Button>
        )}
        {!canPlay && !match.is_bye && match.status !== 'completed' && (
          <Button size="sm" variant="outline" className="w-full h-8 text-xs mt-1"
            onClick={() => onOpen(match)} data-testid={`view-match-${match.match_id}`}>
            View
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Bracket() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tournament, setTournament] = useState(null);
  const [bracket, setBracket] = useState({ rounds: [], champion_id: null });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openMatch, setOpenMatch] = useState(null);
  const [p1Holes, setP1Holes] = useState([]);
  const [p2Holes, setP2Holes] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, b] = await Promise.all([
        axios.get(`${API}/tournaments/${tournamentId}`),
        axios.get(`${API}/tournaments/${tournamentId}/bracket`)
      ]);
      setTournament(t.data);
      setBracket(b.data || { rounds: [], champion_id: null });
    } catch {
      toast.error('Failed to load bracket');
    } finally { setLoading(false); }
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!window.confirm('Generate a new random bracket? This clears any existing matches.')) return;
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/tournaments/${tournamentId}/bracket/generate`);
      toast.success(`${res.data.matches_created} matches created`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate');
    } finally { setGenerating(false); }
  };

  const shareBracket = () => {
    const url = `${window.location.origin}/tournament/${tournamentId}/bracket`;
    navigator.clipboard.writeText(url).then(() => toast.success('Bracket link copied!'));
  };

  const openMatchDialog = (m) => {
    setOpenMatch(m);
    const n = tournament?.num_holes || 18;
    setP1Holes(Array.from({ length: n }, (_, i) => m.player1_holes?.[i] || 0));
    setP2Holes(Array.from({ length: n }, (_, i) => m.player2_holes?.[i] || 0));
  };

  const saveMatch = async () => {
    if (!openMatch) return;
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/tournaments/${tournamentId}/matches/${openMatch.match_id}/score`,
        { player1_holes: p1Holes, player2_holes: p2Holes, pars: tournament?.par_per_hole || [] }
      );
      toast.success(res.data.status === 'completed' ? 'Match completed!' : 'Scores saved');
      setOpenMatch(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  const updateHole = (setter, idx, val) => {
    const v = parseInt(val) || 0;
    setter(prev => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-[#1B3C35]">Loading bracket...</div>
    </div>;
  }

  const champion = bracket.champion_id
    ? bracket.rounds.slice(-1)[0]?.matches?.[0]?.player1?.user_id === bracket.champion_id
      ? bracket.rounds.slice(-1)[0]?.matches?.[0]?.player1
      : bracket.rounds.slice(-1)[0]?.matches?.[0]?.player2
    : null;

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-6xl mx-auto fade-in" data-testid="bracket-page">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="bracket-back-btn">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#C96A52]">Match Play</p>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>
            {tournament?.name || 'Bracket'}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={shareBracket} data-testid="share-bracket-btn">
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {isAdmin && (
        <div className="mb-5 flex gap-2">
          <Button onClick={generate} disabled={generating}
            className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" data-testid="generate-bracket-btn">
            <Shuffle className="h-4 w-4 mr-1" />
            {generating ? 'Generating...' : bracket.rounds.length ? 'Re-shuffle Bracket' : 'Generate Bracket'}
          </Button>
        </div>
      )}

      {champion && (
        <Card className="border-[#C96A52] bg-[#C96A52]/5 shadow-none mb-6" data-testid="bracket-champion">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-[#C96A52]" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#C96A52]">Champion</p>
              <div className="flex items-center gap-2">
                <PlayerAvatar user={champion} size={32} />
                <p className="text-lg font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>{champion.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {bracket.rounds.length === 0 ? (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="py-16 text-center">
            <Trophy className="h-12 w-12 text-[#D6D7D2] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#1B3C35] mb-2" style={{ fontFamily: 'Outfit' }}>
              No bracket yet
            </h3>
            <p className="text-sm text-[#6B6E66]">
              {isAdmin ? 'Generate the bracket once all players are registered.' : 'Waiting for the admin to generate the bracket.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {bracket.rounds.map((r) => (
              <div key={r.bracket_round} className="flex flex-col gap-3 min-w-[240px]">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[#6B6E66]">
                    Round {r.bracket_round}
                  </p>
                  <p className="text-sm font-bold text-[#1B3C35]">{r.round_label}</p>
                </div>
                {r.matches.map(m => (
                  <MatchCard key={m.match_id} match={m} onOpen={openMatchDialog} myId={user?.user_id} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score entry dialog */}
      <Dialog open={!!openMatch} onOpenChange={(v) => !v && setOpenMatch(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>
              {openMatch?.player1?.name} vs {openMatch?.player2?.name || '—'}
            </DialogTitle>
          </DialogHeader>
          {openMatch && (
            <div className="space-y-2">
              <div className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 items-center text-xs font-bold text-[#6B6E66] uppercase tracking-wider">
                <span>Hole</span>
                <span className="truncate">{openMatch.player1?.name}</span>
                <span className="truncate">{openMatch.player2?.name || '—'}</span>
                <span>Par</span>
              </div>
              {(tournament?.par_per_hole || []).map((par, i) => (
                <div key={i} className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 items-center">
                  <span className="text-sm font-bold text-[#1B3C35]">{i + 1}</span>
                  <Input type="number" min="0" max="15" value={p1Holes[i] || ''}
                    onChange={e => updateHole(setP1Holes, i, e.target.value)}
                    className="h-9 text-center" data-testid={`p1-hole-${i + 1}`} />
                  <Input type="number" min="0" max="15" value={p2Holes[i] || ''}
                    onChange={e => updateHole(setP2Holes, i, e.target.value)}
                    className="h-9 text-center" data-testid={`p2-hole-${i + 1}`}
                    disabled={!openMatch.player2_id} />
                  <span className="text-xs text-[#6B6E66] text-center">{par}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMatch(null)}>Cancel</Button>
            <Button onClick={saveMatch} disabled={saving}
              className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" data-testid="save-match-btn">
              {saving ? 'Saving...' : 'Save Scores'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
