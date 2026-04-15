import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Target, Trophy, UserPlus, MapPin, Check, Save } from 'lucide-react';

export default function ChallengeDetail() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [logCourseId, setLogCourseId] = useState('');
  const [logPlayerId, setLogPlayerId] = useState('');
  const [logHoles, setLogHoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  const fetchChallenge = async () => {
    try {
      const res = await axios.get(`${API}/challenges/${challengeId}`);
      setChallenge(res.data);
    } catch {
      toast.error('Challenge not found');
      navigate('/challenges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChallenge(); }, [challengeId]);

  const handleJoin = async () => {
    try {
      await axios.post(`${API}/challenges/${challengeId}/join`);
      toast.success('Joined!');
      fetchChallenge();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to join');
    }
  };

  const addPlayer = async () => {
    if (!newPlayerName.trim()) return;
    try {
      await axios.post(`${API}/challenges/${challengeId}/add-player`, { name: newPlayerName.trim() });
      toast.success(`${newPlayerName.trim()} added!`);
      setNewPlayerName('');
      setShowAddPlayer(false);
      fetchChallenge();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const openLogRound = (courseId, playerId) => {
    const courseInfo = challenge.courses_info.find(c => c.course_id === courseId);
    if (!courseInfo) return;
    setLogCourseId(courseId);
    setLogPlayerId(playerId || user?.user_id || '');
    setLogHoles(courseInfo.holes.map(h => ({ hole: h.hole, par: h.par, strokes: 0 })));
    setShowLog(true);
  };

  const submitRound = async () => {
    setSaving(true);
    try {
      const res = await axios.post(`${API}/challenges/${challengeId}/log-round`, {
        course_id: logCourseId, user_id: logPlayerId, holes: logHoles
      });
      if (res.data.won) {
        toast.success('CHALLENGE COMPLETE! Winner!', { duration: 5000 });
      } else if (res.data.new_birdies.length > 0) {
        toast.success(`${res.data.new_birdies.length} new birdie(s)! (${res.data.total_completed}/${res.data.total_needed})`);
      } else {
        toast.info('Round logged. No new birdies this time.');
      }
      setShowLog(false);
      fetchChallenge();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to log round');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading...</div>
      </div>
    );
  }

  const isParticipant = challenge.participants?.some(p => p.user_id === user?.user_id);
  const isAdmin = user?.role === 'admin';
  const participants = challenge.participants || [];
  const sortedParticipants = [...participants].sort((a, b) => (b.completed_holes || 0) - (a.completed_holes || 0));

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto fade-in" data-testid="challenge-detail">
      <Button variant="ghost" size="sm" className="mb-4 text-[#6B6E66]" onClick={() => navigate('/challenges')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Challenges
      </Button>

      {/* Header */}
      <Card className="border-[#E2E3DD] shadow-none mb-6">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                {challenge.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-[#6B6E66]">
                <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />{challenge.total_holes} holes to birdie</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{challenge.courses_info?.length} course(s)</span>
              </div>
              {challenge.winner_name && (
                <div className="flex items-center gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <span className="font-bold text-amber-700">{challenge.winner_name} completed the challenge!</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {challenge.status === 'active' && !isParticipant && user && (
                <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={handleJoin} data-testid="join-challenge-btn">
                  Join Challenge
                </Button>
              )}
              {isAdmin && challenge.status === 'active' && (
                <Button variant="outline" className="border-[#E2E3DD]" onClick={() => setShowAddPlayer(true)}
                  data-testid="add-challenge-player-btn">
                  <UserPlus className="h-4 w-4 mr-1" />Add Player
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants Leaderboard */}
      <Card className="border-[#E2E3DD] shadow-none mb-6">
        <CardHeader className="py-3 bg-[#1B3C35] rounded-t-xl">
          <CardTitle className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedParticipants.map((p, i) => {
            const pct = challenge.total_holes > 0 ? Math.round(((p.completed_holes || 0) / challenge.total_holes) * 100) : 0;
            return (
              <div key={p.user_id} className="px-4 py-3 border-b border-[#E2E3DD] last:border-0" data-testid={`participant-${i}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1B3C35] w-6 tabular-nums">{i + 1}</span>
                    <span className="font-medium text-[#1B3C35]">{p.player_name}</span>
                    {p.user_id === challenge.winner_id && <Trophy className="h-4 w-4 text-amber-500" />}
                  </div>
                  <span className="text-sm font-bold text-[#C96A52] tabular-nums">{p.completed_holes || 0}/{challenge.total_holes}</span>
                </div>
                <div className="h-3 bg-[#E8E9E3] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: pct === 100 ? '#C96A52' : '#1B3C35' }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Course Progress Grids */}
      {challenge.courses_info?.map(course => (
        <Card key={course.course_id} className="border-[#E2E3DD] shadow-none mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                {course.course_name}
              </CardTitle>
              {challenge.status === 'active' && (isParticipant || isAdmin) && (
                <Button size="sm" className="bg-[#C96A52] hover:bg-[#C96A52]/90"
                  onClick={() => openLogRound(course.course_id, isAdmin ? sortedParticipants[0]?.user_id : '')}
                  data-testid={`log-round-btn-${course.course_id}`}>
                  Log Round
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Hole header */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E2E3DD]">
                    <th className="text-left py-1.5 px-1 text-[#6B6E66] font-bold w-24">Player</th>
                    {course.holes?.map(h => (
                      <th key={h.hole} className="py-1.5 px-0.5 text-center text-[#6B6E66] font-bold min-w-[1.8rem]">
                        <div>{h.hole}</div>
                        <div className="text-[9px] font-normal">P{h.par}</div>
                      </th>
                    ))}
                    <th className="py-1.5 px-1 text-center text-[#1B3C35] font-bold bg-[#E8E9E3]/50">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedParticipants.map(p => {
                    const birdied = new Set(
                      (p.birdied_holes || [])
                        .filter(b => b.course_id === course.course_id)
                        .map(b => b.hole_number)
                    );
                    return (
                      <tr key={p.user_id} className="border-b border-[#E2E3DD] last:border-0">
                        <td className="py-1.5 px-1 font-medium text-[#1B3C35] truncate max-w-[6rem]">{p.player_name}</td>
                        {course.holes?.map(h => (
                          <td key={h.hole} className="py-1 px-0.5 text-center">
                            {birdied.has(h.hole) ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#C96A52] text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#E8E9E3] text-[#6B6E66] text-[10px]">
                                {h.hole}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="py-1.5 px-1 text-center font-bold text-[#1B3C35] bg-[#E8E9E3]/50 tabular-nums">
                          {birdied.size}/{course.holes?.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Log Round Dialog */}
      <Dialog open={showLog} onOpenChange={setShowLog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Log Round</DialogTitle>
            <DialogDescription>Enter scores. Birdies (under par) will be automatically marked!</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Player selector for admin */}
            {isAdmin && participants.length > 0 && (
              <div>
                <Label className="text-[#1B3C35] text-xs font-bold uppercase">Player</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {participants.map(p => (
                    <Button key={p.user_id} size="sm"
                      variant={logPlayerId === p.user_id ? 'default' : 'outline'}
                      className={logPlayerId === p.user_id ? 'bg-[#1B3C35]' : 'border-[#E2E3DD]'}
                      onClick={() => setLogPlayerId(p.user_id)}
                      data-testid={`log-player-${p.user_id}`}>
                      {p.player_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {/* Hole inputs */}
            <div className="grid grid-cols-9 gap-1">
              {logHoles.map((h, i) => {
                const isBirdie = h.strokes > 0 && h.strokes < h.par;
                return (
                  <div key={h.hole} className="text-center">
                    <div className="text-[9px] text-[#6B6E66] font-bold">{h.hole}</div>
                    <div className="text-[9px] text-[#6B6E66]">P{h.par}</div>
                    <input type="number" min="0" max="15" value={h.strokes || ''}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setLogHoles(prev => {
                          const u = [...prev];
                          u[i] = { ...u[i], strokes: val };
                          return u;
                        });
                      }}
                      className={`w-full h-9 text-center text-sm font-bold rounded border focus:ring-1 focus:ring-[#1B3C35] focus:outline-none ${
                        isBirdie ? 'border-[#C96A52] bg-[#C96A52]/10 text-[#C96A52]' : 'border-[#E2E3DD] bg-white text-[#1B3C35]'
                      }`}
                      data-testid={`log-hole-${h.hole}`} />
                  </div>
                );
              })}
            </div>
            {logHoles.some(h => h.strokes > 0 && h.strokes < h.par) && (
              <p className="text-sm text-[#C96A52] font-medium">
                Birdies detected on holes: {logHoles.filter(h => h.strokes > 0 && h.strokes < h.par).map(h => h.hole).join(', ')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLog(false)}>Cancel</Button>
            <Button onClick={submitRound} disabled={saving} className="bg-[#1B3C35] hover:bg-[#1B3C35]/90"
              data-testid="submit-round-btn">
              <Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Submit Round'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Player Dialog */}
      <Dialog open={showAddPlayer} onOpenChange={setShowAddPlayer}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Add Player</DialogTitle>
            <DialogDescription>Add a friend to this challenge.</DialogDescription>
          </DialogHeader>
          <Input value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
            placeholder="Player name" className="border-[#E2E3DD]"
            onKeyDown={e => e.key === 'Enter' && addPlayer()} data-testid="challenge-player-name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPlayer(false)}>Cancel</Button>
            <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={addPlayer}
              data-testid="confirm-add-challenge-player">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
