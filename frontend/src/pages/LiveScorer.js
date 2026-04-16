import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Save, Trophy, Check, Share2 } from 'lucide-react';

function calcStableford(strokes, par) {
  if (strokes === 0) return 0;
  const diff = strokes - par;
  if (diff >= 2) return 0;
  if (diff === 1) return 1;
  if (diff === 0) return 2;
  if (diff === -1) return 3;
  if (diff === -2) return 4;
  return 5;
}

function formatToPar(s) { return s === 0 ? 'E' : s > 0 ? `+${s}` : `${s}`; }
function scoreClr(s) { return s < 0 ? 'text-[#C96A52]' : s > 0 ? 'text-[#1D2D44]' : 'text-[#4A5D23]'; }

export default function LiveScorer() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [roster, setRoster] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [holes, setHoles] = useState([]);
  const [allPlayerScores, setAllPlayerScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tRes, rosterRes, scoresRes] = await Promise.all([
        axios.get(`${API}/tournaments/${tournamentId}`),
        axios.get(`${API}/tournaments/${tournamentId}/roster`),
        axios.get(`${API}/scorecards/tournament/${tournamentId}/all`)
      ]);
      setTournament(tRes.data);
      setRoster(rosterRes.data);

      // Pre-load all existing scores
      const scMap = {};
      for (const sc of (scoresRes.data || [])) {
        const key = `${sc.user_id}_${sc.round_number}`;
        scMap[key] = sc.holes;
      }
      setAllPlayerScores(scMap);

      if (rosterRes.data.length > 0 && !selectedPlayer) {
        const firstId = rosterRes.data[0].user_id;
        setSelectedPlayer(firstId);
        const firstKey = `${firstId}_1`;
        setHoles(scMap[firstKey] || tRes.data.par_per_hole.map((par, i) => ({ hole: i + 1, par, strokes: 0 })));
      }
    } catch {
      toast.error('Failed to load tournament');
      navigate('/admin');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load scores when switching player/round
  useEffect(() => {
    if (!selectedPlayer || !tournament) return;
    const key = `${selectedPlayer}_${roundNumber}`;
    if (allPlayerScores[key]) {
      setHoles(allPlayerScores[key]);
    } else {
      setHoles(tournament.par_per_hole.map((par, i) => ({ hole: i + 1, par, strokes: 0 })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayer, roundNumber]);

  const updateHole = (index, strokes) => {
    const val = parseInt(strokes) || 0;
    if (val < 0 || val > 15) return;
    setHoles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], strokes: val };
      return updated;
    });
  };

  const saveCurrentPlayer = async () => {
    if (!selectedPlayer) return;
    setSaving(true);
    try {
      await axios.post(`${API}/scorecards/keeper`, {
        tournament_id: tournamentId,
        user_id: selectedPlayer,
        round_number: roundNumber,
        holes
      });
      const key = `${selectedPlayer}_${roundNumber}`;
      setAllPlayerScores(prev => ({ ...prev, [key]: holes }));
      toast.success(`Score saved for ${roster.find(r => r.user_id === selectedPlayer)?.player_name}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addPlayer = async () => {
    if (!newPlayerName.trim()) return;
    setAddingPlayer(true);
    try {
      const res = await axios.post(`${API}/tournaments/${tournamentId}/add-player`, {
        name: newPlayerName.trim()
      });
      toast.success(`${newPlayerName.trim()} added!`);
      setNewPlayerName('');
      setShowAddPlayer(false);
      await fetchData();
      setSelectedPlayer(res.data.user_id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add player');
    } finally {
      setAddingPlayer(false);
    }
  };

  const switchPlayer = (userId) => {
    // Save current player's holes locally
    if (selectedPlayer) {
      const key = `${selectedPlayer}_${roundNumber}`;
      setAllPlayerScores(prev => ({ ...prev, [key]: holes }));
    }
    setSelectedPlayer(userId);
  };

  if (loading || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading...</div>
      </div>
    );
  }

  const numRounds = tournament.num_rounds || 1;
  const currentPlayer = roster.find(r => r.user_id === selectedPlayer);
  const played = holes.filter(h => h.strokes > 0);
  const totalStrokes = played.reduce((s, h) => s + h.strokes, 0);
  const totalPar = played.reduce((s, h) => s + h.par, 0);
  const toPar = totalStrokes - totalPar;

  // Mini standings from local data
  const standings = roster.map(r => {
    let playerTotal = 0;
    let playerPar = 0;
    for (let rn = 1; rn <= numRounds; rn++) {
      const key = `${r.user_id}_${rn}`;
      const sc = allPlayerScores[key];
      if (sc) {
        const p = sc.filter(h => h.strokes > 0);
        playerTotal += p.reduce((s, h) => s + h.strokes, 0);
        playerPar += p.reduce((s, h) => s + h.par, 0);
      }
    }
    return { ...r, total: playerTotal, toPar: playerTotal - playerPar, hasScores: playerTotal > 0 };
  }).filter(r => r.hasScores).sort((a, b) => a.toPar - b.toPar);

  return (
    <div className="min-h-screen p-3 sm:p-6 max-w-5xl mx-auto fade-in" data-testid="live-scorer">
      <Button variant="ghost" size="sm" className="mb-3 text-[#6B6E66]" onClick={() => navigate('/admin')} data-testid="back-btn">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      {/* Tournament Header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52]">Live Scorer</p>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
            {tournament.name}
          </h1>
          <p className="text-sm text-[#6B6E66]">{tournament.course_name}</p>
        </div>
        <Button size="sm" className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={() => setShowAddPlayer(true)}
          data-testid="add-player-btn">
          <UserPlus className="h-4 w-4 mr-1" />Add Player
        </Button>
        <Button size="sm" variant="outline" className="border-[#1B3C35] text-[#1B3C35]"
          onClick={() => {
            const url = `${window.location.origin}/leaderboard/${tournamentId}`;
            navigator.clipboard.writeText(url).then(() => toast.success('Leaderboard link copied!'));
          }} data-testid="share-leaderboard-btn">
          <Share2 className="h-4 w-4 mr-1" />Share
        </Button>
      </div>

      {/* Player Selector */}
      {roster.length === 0 ? (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="py-12 text-center">
            <UserPlus className="h-10 w-10 text-[#D6D7D2] mx-auto mb-3" />
            <p className="text-[#6B6E66] mb-4">Add the players to get started</p>
            <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={() => setShowAddPlayer(true)}
              data-testid="add-first-player-btn">
              <UserPlus className="h-4 w-4 mr-1" />Add First Player
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Player Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {roster.map(r => (
              <Button
                key={r.user_id}
                variant={r.user_id === selectedPlayer ? 'default' : 'outline'}
                size="sm"
                onClick={() => switchPlayer(r.user_id)}
                className={`shrink-0 ${r.user_id === selectedPlayer ? 'bg-[#1B3C35] hover:bg-[#1B3C35]/90' : 'border-[#E2E3DD] text-[#1B3C35]'}`}
                data-testid={`player-tab-${r.user_id}`}
              >
                {r.player_name}
              </Button>
            ))}
          </div>

          {/* Round Tabs */}
          {numRounds > 1 && (
            <div className="flex gap-2 mb-4">
              {Array.from({ length: numRounds }, (_, i) => i + 1).map(r => (
                <Button key={r} variant={r === roundNumber ? 'default' : 'outline'} size="sm"
                  onClick={() => setRoundNumber(r)}
                  className={`${r === roundNumber ? 'bg-[#C96A52] hover:bg-[#C96A52]/90' : 'border-[#E2E3DD] text-[#6B6E66]'}`}
                  data-testid={`round-btn-${r}`}>
                  R{r}
                </Button>
              ))}
            </div>
          )}

          {/* Scorecard */}
          {currentPlayer && (
            <Card className="border-[#E2E3DD] shadow-none mb-4">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                    {currentPlayer.player_name} - R{roundNumber}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold tabular-nums ${played.length > 0 ? scoreClr(toPar) : 'text-[#6B6E66]'}`}>
                      {played.length > 0 ? formatToPar(toPar) : '-'}
                    </span>
                    <span className="text-sm text-[#6B6E66] tabular-nums">{totalStrokes || '-'}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3">
                {/* Mobile-first vertical hole list with +/- steppers */}
                <div className="space-y-2">
                  {holes.map((h, i) => {
                    const diff = h.strokes > 0 ? h.strokes - h.par : null;
                    let borderColor = 'border-[#E2E3DD]';
                    let bgColor = 'bg-white';
                    let scoreLabel = '';
                    if (diff !== null) {
                      if (diff <= -2) { borderColor = 'border-amber-400'; bgColor = 'bg-amber-50'; scoreLabel = 'Eagle'; }
                      else if (diff === -1) { borderColor = 'border-[#C96A52]'; bgColor = 'bg-[#C96A52]/10'; scoreLabel = 'Birdie'; }
                      else if (diff === 0) { borderColor = 'border-[#4A5D23]'; bgColor = 'bg-[#4A5D23]/10'; scoreLabel = 'Par'; }
                      else if (diff === 1) { borderColor = 'border-[#1D2D44]'; bgColor = 'bg-[#1D2D44]/10'; scoreLabel = 'Bogey'; }
                      else { borderColor = 'border-[#1D2D44]'; bgColor = 'bg-[#1D2D44]/15'; scoreLabel = `+${diff}`; }
                    }
                    // Insert front/back 9 separator
                    const showSeparator = i === 9;
                    return (
                      <div key={h.hole}>
                        {showSeparator && (
                          <div className="text-center text-xs font-bold text-[#6B6E66] uppercase tracking-wider py-2 border-t border-[#E2E3DD] mt-2">
                            Back 9
                          </div>
                        )}
                        <div className={`flex items-center justify-between rounded-xl border-2 ${borderColor} ${bgColor} px-4 py-3`}
                          data-testid={`keeper-hole-row-${h.hole}`}>
                          {/* Hole info */}
                          <div className="flex items-center gap-3 min-w-[70px]">
                            <span className="text-lg font-bold text-[#1B3C35] w-7 text-center">{h.hole}</span>
                            <div className="text-center">
                              <div className="text-[10px] text-[#6B6E66] uppercase font-bold">Par</div>
                              <div className="text-sm font-bold text-[#1B3C35]">{h.par}</div>
                            </div>
                          </div>
                          {/* Score label */}
                          {scoreLabel && (
                            <span className={`text-xs font-bold ${diff < 0 ? 'text-[#C96A52]' : diff === 0 ? 'text-[#4A5D23]' : 'text-[#1D2D44]'}`}>
                              {scoreLabel}
                            </span>
                          )}
                          {/* +/- Stepper */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateHole(i, Math.max(0, (h.strokes || 0) - 1))}
                              className="w-12 h-12 rounded-full bg-[#1B3C35] text-white text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform"
                              data-testid={`keeper-minus-${h.hole}`}>
                              −
                            </button>
                            <span className="text-2xl font-bold text-[#1B3C35] w-10 text-center tabular-nums"
                              data-testid={`keeper-score-${h.hole}`}>
                              {h.strokes || '–'}
                            </span>
                            <button
                              onClick={() => updateHole(i, (h.strokes || 0) + 1)}
                              className="w-12 h-12 rounded-full bg-[#C96A52] text-white text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform"
                              data-testid={`keeper-plus-${h.hole}`}>
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#E2E3DD]">
                  <span className="text-sm text-[#6B6E66]">{played.length}/{holes.length} holes</span>
                  <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12 px-6 text-base" onClick={saveCurrentPlayer}
                    disabled={saving} data-testid="save-keeper-btn">
                    <Save className="h-5 w-5 mr-2" />{saving ? 'Saving...' : 'Save Score'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Mini Standings */}
          {standings.length > 0 && (
            <Card className="border-[#E2E3DD] shadow-none">
              <CardHeader className="py-3 bg-[#1B3C35] rounded-t-xl">
                <CardTitle className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5" /> Live Standings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {standings.map((s, i) => (
                  <div key={s.user_id}
                    className={`flex items-center justify-between px-4 py-2.5 border-b border-[#E2E3DD] last:border-0 ${s.user_id === selectedPlayer ? 'bg-[#E8E9E3]/50' : ''}`}
                    data-testid={`standing-${i}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#1B3C35] w-6 tabular-nums">{i + 1}</span>
                      <span className="text-sm font-medium text-[#1B3C35]">{s.player_name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-bold tabular-nums ${scoreClr(s.toPar)}`}>
                        {formatToPar(s.toPar)}
                      </span>
                      <span className="text-xs text-[#6B6E66] tabular-nums w-8 text-right">{s.total}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Player Dialog */}
      <Dialog open={showAddPlayer} onOpenChange={setShowAddPlayer}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Add Player</DialogTitle>
            <DialogDescription>Add a player to this tournament. They don't need an account.</DialogDescription>
          </DialogHeader>
          <Input value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
            placeholder="Player name (e.g. Maria)" className="border-[#E2E3DD]"
            data-testid="new-player-name-input"
            onKeyDown={e => e.key === 'Enter' && addPlayer()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPlayer(false)}>Cancel</Button>
            <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={addPlayer} disabled={addingPlayer}
              data-testid="confirm-add-player-btn">
              {addingPlayer ? 'Adding...' : 'Add Player'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
