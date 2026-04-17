import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Save, Trophy, Check, Share2, Camera, Pencil, Trash2, X, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import TournamentFeed from '@/components/TournamentFeed';

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
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editName, setEditName] = useState('');
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);

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

  const renamePlayer = async () => {
    if (!editingPlayer || !editName.trim()) return;
    try {
      await axios.put(`${API}/tournaments/${tournamentId}/player/${editingPlayer}`, {
        name: editName.trim()
      });
      toast.success('Name updated!');
      setEditingPlayer(null);
      setEditName('');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to rename');
    }
  };

  const removePlayer = async (userId, playerName) => {
    if (!window.confirm(`Remove ${playerName} from tournament?`)) return;
    try {
      await axios.delete(`${API}/tournaments/${tournamentId}/player/${userId}`);
      toast.success(`${playerName} removed`);
      if (selectedPlayer === userId) setSelectedPlayer(null);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove');
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
        <Link to={`/tournament/${tournamentId}/settings`}>
          <Button size="sm" variant="outline" className="border-[#E2E3DD] text-[#1B3C35]" data-testid="manage-players-btn">
            <Users className="h-4 w-4 mr-1" />Manage
          </Button>
        </Link>
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

          {/* Scorecard - One hole at a time */}
          {currentPlayer && (
            <div className="mb-4" data-testid="scorecard-carousel">
              {/* Player header + total */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                  {currentPlayer.player_name} - R{roundNumber}
                </p>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold tabular-nums ${played.length > 0 ? scoreClr(toPar) : 'text-[#6B6E66]'}`}>
                    {played.length > 0 ? formatToPar(toPar) : '-'}
                  </span>
                  <span className="text-sm text-[#6B6E66] tabular-nums">{totalStrokes || '-'}</span>
                </div>
              </div>

              {/* Hole dots / progress */}
              <div className="flex gap-1 justify-center mb-4 flex-wrap">
                {holes.map((h, i) => {
                  const diff = h.strokes > 0 ? h.strokes - h.par : null;
                  let dotColor = 'bg-[#E2E3DD]';
                  if (i === currentHoleIndex) dotColor = 'bg-[#1B3C35] ring-2 ring-[#1B3C35]/30';
                  else if (diff !== null) {
                    if (diff < 0) dotColor = 'bg-[#C96A52]';
                    else if (diff === 0) dotColor = 'bg-[#4A5D23]';
                    else dotColor = 'bg-[#1D2D44]';
                  }
                  return (
                    <button key={i} onClick={() => setCurrentHoleIndex(i)}
                      className={`w-5 h-5 rounded-full ${dotColor} text-[8px] font-bold text-white flex items-center justify-center active:scale-90`}
                      data-testid={`hole-dot-${h.hole}`}>
                      {h.strokes > 0 ? h.strokes : ''}
                    </button>
                  );
                })}
              </div>

              {/* Current hole card */}
              {(() => {
                const h = holes[currentHoleIndex];
                if (!h) return null;
                const diff = h.strokes > 0 ? h.strokes - h.par : null;
                let bgColor = 'bg-white';
                let scoreLabel = '';
                if (diff !== null) {
                  if (diff <= -2) { bgColor = 'bg-amber-50'; scoreLabel = 'Eagle!'; }
                  else if (diff === -1) { bgColor = 'bg-[#C96A52]/10'; scoreLabel = 'Birdie!'; }
                  else if (diff === 0) { bgColor = 'bg-[#4A5D23]/10'; scoreLabel = 'Par'; }
                  else if (diff === 1) { bgColor = 'bg-[#1D2D44]/10'; scoreLabel = 'Bogey'; }
                  else { bgColor = 'bg-[#1D2D44]/15'; scoreLabel = `+${diff}`; }
                }
                return (
                  <Card className={`border-[#E2E3DD] shadow-none ${bgColor} transition-colors`}>
                    <CardContent className="py-8 px-4">
                      {/* Hole number + par */}
                      <div className="text-center mb-6">
                        <p className="text-xs text-[#6B6E66] uppercase font-bold tracking-widest">Hole</p>
                        <p className="text-5xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>{h.hole}</p>
                        <p className="text-sm text-[#6B6E66] mt-1">Par {h.par}{h.yards ? ` • ${h.yards} yds` : ''}</p>
                      </div>

                      {/* Score label */}
                      {scoreLabel && (
                        <p className={`text-center text-lg font-bold mb-4 ${diff < 0 ? 'text-[#C96A52]' : diff === 0 ? 'text-[#4A5D23]' : 'text-[#1D2D44]'}`}>
                          {scoreLabel}
                        </p>
                      )}

                      {/* Big +/- stepper */}
                      <div className="flex items-center justify-center gap-6">
                        <button
                          onClick={() => updateHole(currentHoleIndex, Math.max(0, (h.strokes || 0) - 1))}
                          className="w-16 h-16 rounded-full bg-[#1B3C35] text-white text-3xl font-bold flex items-center justify-center active:scale-90 transition-transform"
                          data-testid={`keeper-minus-${h.hole}`}>
                          −
                        </button>
                        <span className="text-5xl font-bold text-[#1B3C35] w-16 text-center tabular-nums"
                          style={{ fontFamily: 'Outfit' }} data-testid={`keeper-score-${h.hole}`}>
                          {h.strokes || '–'}
                        </span>
                        <button
                          onClick={() => updateHole(currentHoleIndex, (h.strokes || 0) + 1)}
                          className="w-16 h-16 rounded-full bg-[#C96A52] text-white text-3xl font-bold flex items-center justify-center active:scale-90 transition-transform"
                          data-testid={`keeper-plus-${h.hole}`}>
                          +
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Navigation arrows */}
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" className="border-[#E2E3DD] h-12 px-4"
                  disabled={currentHoleIndex === 0}
                  onClick={() => setCurrentHoleIndex(currentHoleIndex - 1)}
                  data-testid="prev-hole-btn">
                  <ChevronLeft className="h-5 w-5 mr-1" />Prev
                </Button>
                <span className="text-sm text-[#6B6E66] tabular-nums">{currentHoleIndex + 1} / {holes.length}</span>
                {currentHoleIndex < holes.length - 1 ? (
                  <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12 px-4"
                    onClick={() => setCurrentHoleIndex(currentHoleIndex + 1)}
                    data-testid="next-hole-btn">
                    Next<ChevronRight className="h-5 w-5 ml-1" />
                  </Button>
                ) : (
                  <Button className="bg-[#C96A52] hover:bg-[#C96A52]/90 h-12 px-4" onClick={saveCurrentPlayer}
                    disabled={saving} data-testid="save-keeper-btn">
                    <Save className="h-5 w-5 mr-1" />{saving ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </div>

              {/* Quick save (visible when not on last hole) */}
              {currentHoleIndex < holes.length - 1 && (
                <Button variant="outline" className="w-full mt-3 border-[#E2E3DD] h-10 text-sm"
                  onClick={saveCurrentPlayer} disabled={saving} data-testid="quick-save-btn">
                  <Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save Progress'}
                </Button>
              )}
            </div>
          )}

          {/* Photo Feed - Upload from here */}
          <div className="mb-4">
            <TournamentFeed tournamentId={tournamentId} canPost={true} />
          </div>

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
