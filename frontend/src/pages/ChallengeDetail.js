import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Target, Trophy, MapPin, Check, Save, Share2, CirclePlay, Trash2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export default function ChallengeDetail() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add Round state
  const [showAddRound, setShowAddRound] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [logPlayerId, setLogPlayerId] = useState('');
  const [logHoles, setLogHoles] = useState([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);

  // Remove player confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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

  const removePlayer = async (userId, name) => {
    if (confirmDeleteId !== userId) {
      setConfirmDeleteId(userId);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    try {
      await axios.post(`${API}/challenges/${challengeId}/remove-player`, { user_id: userId });
      toast.success(`${name} removed`);
      setConfirmDeleteId(null);
      fetchChallenge();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const openAddRound = (courseId, playerId) => {
    const courseInfo = challenge.courses_info.find(c => c.course_id === courseId);
    if (!courseInfo) return;
    setSelectedCourse(courseInfo);
    setLogPlayerId(playerId || user?.user_id || '');
    setLogHoles(courseInfo.holes.map(h => ({ hole: h.hole, par: h.par, strokes: 0 })));
    setCurrentHoleIndex(0);
    setShowAddRound(true);
  };

  const submitRound = async () => {
    setSaving(true);
    try {
      const res = await axios.post(`${API}/challenges/${challengeId}/log-round`, {
        course_id: selectedCourse.course_id, user_id: logPlayerId, holes: logHoles
      });
      if (res.data.won) {
        toast.success('CHALLENGE COMPLETE! Winner!', { duration: 5000 });
      } else if (res.data.new_birdies?.length > 0) {
        toast.success(`${res.data.new_birdies.length} new birdie(s)! (${res.data.total_completed}/${res.data.total_needed})`);
      } else {
        toast.info('Round logged. No new birdies this time.');
      }
      setShowAddRound(false);
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
  const isCreator = challenge.created_by === user?.user_id;
  const isAdmin = user?.role === 'admin';
  const canManage = isCreator || isAdmin;
  const participants = challenge.participants || [];
  const sortedParticipants = [...participants].sort((a, b) => (b.completed_holes || 0) - (a.completed_holes || 0));

  // Add Round view (full page carousel)
  if (showAddRound) {
    const h = logHoles[currentHoleIndex];
    const diff = h?.strokes > 0 ? h.strokes - h.par : null;
    let bgColor = 'bg-white';
    let scoreLabel = '';
    if (diff !== null) {
      if (diff <= -2) { bgColor = 'bg-amber-50'; scoreLabel = 'Eagle!'; }
      else if (diff === -1) { bgColor = 'bg-[#C96A52]/10'; scoreLabel = 'Birdie!'; }
      else if (diff === 0) { bgColor = 'bg-[#4A5D23]/10'; scoreLabel = 'Par'; }
      else if (diff === 1) { bgColor = 'bg-[#1D2D44]/10'; scoreLabel = 'Bogey'; }
      else if (diff > 1) { bgColor = 'bg-[#1D2D44]/15'; scoreLabel = `+${diff}`; }
    }

    return (
      <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto" data-testid="add-round-view">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setShowAddRound(false)}
            className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>Add Round</h1>
            <p className="text-xs text-[#6B6E66]">{selectedCourse?.course_name}</p>
          </div>
        </div>

        {/* Player selector for organizer */}
        {canManage && participants.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {participants.map(p => (
              <Button key={p.user_id} size="sm"
                variant={logPlayerId === p.user_id ? 'default' : 'outline'}
                className={`shrink-0 ${logPlayerId === p.user_id ? 'bg-[#1B3C35]' : 'border-[#E2E3DD]'}`}
                onClick={() => setLogPlayerId(p.user_id)}>
                {p.player_name}
              </Button>
            ))}
          </div>
        )}

        {/* Hole dots */}
        <div className="flex gap-1 justify-center mb-4 flex-wrap">
          {logHoles.map((hole, i) => {
            const d = hole.strokes > 0 ? hole.strokes - hole.par : null;
            let dotColor = 'bg-[#E2E3DD]';
            if (i === currentHoleIndex) dotColor = 'bg-[#1B3C35] ring-2 ring-[#1B3C35]/30';
            else if (d !== null) {
              if (d < 0) dotColor = 'bg-[#C96A52]';
              else if (d === 0) dotColor = 'bg-[#4A5D23]';
              else dotColor = 'bg-[#1D2D44]';
            }
            return (
              <button key={i} onClick={() => setCurrentHoleIndex(i)}
                className={`w-5 h-5 rounded-full ${dotColor} text-[8px] font-bold text-white flex items-center justify-center active:scale-90`}>
                {hole.strokes > 0 ? hole.strokes : ''}
              </button>
            );
          })}
        </div>

        {/* Current hole */}
        {h && (
          <Card className={`border-[#E2E3DD] shadow-none ${bgColor} transition-colors`}>
            <CardContent className="py-8 px-4">
              <div className="text-center mb-6">
                <p className="text-xs text-[#6B6E66] uppercase font-bold tracking-widest">Hole</p>
                <p className="text-5xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>{h.hole}</p>
                <p className="text-sm text-[#6B6E66] mt-1">Par {h.par}</p>
              </div>
              {scoreLabel && (
                <p className={`text-center text-lg font-bold mb-4 ${diff < 0 ? 'text-[#C96A52]' : diff === 0 ? 'text-[#4A5D23]' : 'text-[#1D2D44]'}`}>
                  {scoreLabel}
                </p>
              )}
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => {
                    const val = Math.max(0, (h.strokes || 0) - 1);
                    setLogHoles(prev => { const u = [...prev]; u[currentHoleIndex] = { ...u[currentHoleIndex], strokes: val }; return u; });
                  }}
                  className="w-16 h-16 rounded-full bg-[#1B3C35] text-white text-3xl font-bold flex items-center justify-center active:scale-90 transition-transform">
                  −
                </button>
                <span className="text-5xl font-bold text-[#1B3C35] w-16 text-center tabular-nums" style={{ fontFamily: 'Outfit' }}>
                  {h.strokes || '–'}
                </span>
                <button onClick={() => {
                    const val = (h.strokes || 0) + 1;
                    setLogHoles(prev => { const u = [...prev]; u[currentHoleIndex] = { ...u[currentHoleIndex], strokes: val }; return u; });
                  }}
                  className="w-16 h-16 rounded-full bg-[#C96A52] text-white text-3xl font-bold flex items-center justify-center active:scale-90 transition-transform">
                  +
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" className="border-[#E2E3DD] h-12 px-4"
            disabled={currentHoleIndex === 0}
            onClick={() => setCurrentHoleIndex(currentHoleIndex - 1)}>
            <ChevronLeft className="h-5 w-5 mr-1" />Prev
          </Button>
          <span className="text-sm text-[#6B6E66] tabular-nums">{currentHoleIndex + 1} / {logHoles.length}</span>
          {currentHoleIndex < logHoles.length - 1 ? (
            <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12 px-4"
              onClick={() => setCurrentHoleIndex(currentHoleIndex + 1)}>
              Next<ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          ) : (
            <Button className="bg-[#C96A52] hover:bg-[#C96A52]/90 h-12 px-4" onClick={submitRound}
              disabled={saving}>
              <Save className="h-5 w-5 mr-1" />{saving ? 'Saving...' : 'Submit'}
            </Button>
          )}
        </div>

        {/* Birdies detected */}
        {logHoles.some(hole => hole.strokes > 0 && hole.strokes < hole.par) && (
          <div className="mt-4 bg-[#C96A52]/10 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-[#C96A52]">
              Birdies: Holes {logHoles.filter(hole => hole.strokes > 0 && hole.strokes < hole.par).map(hole => hole.hole).join(', ')}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Main challenge view
  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto" data-testid="challenge-detail">
      <button onClick={() => navigate('/challenges')}
        className="flex items-center gap-1 text-sm text-[#6B6E66] mb-4 active:scale-95">
        <ArrowLeft className="h-4 w-4" /> Challenges
      </button>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="text-xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>{challenge.name}</h1>
          <Badge className={challenge.status === 'active'
            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'}>
            {challenge.winner_name ? `Won by ${challenge.winner_name}` : challenge.status}
          </Badge>
        </div>
        <p className="text-xs text-[#6B6E66]">
          <Target className="h-3 w-3 inline mr-1" />{challenge.total_holes} holes to birdie &middot; {participants.length} players
        </p>
      </div>

      {/* Action buttons */}
      <div className="space-y-2 mb-5">
        {!isParticipant && challenge.status === 'active' && user && (
          <Button className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12" onClick={handleJoin}
            data-testid="join-challenge-btn">
            <Plus className="h-5 w-5 mr-2" />Join Challenge
          </Button>
        )}
        {isParticipant && challenge.status === 'active' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/play">
                <Button className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12" data-testid="play-round-btn">
                  <CirclePlay className="h-5 w-5 mr-2" />Play a Round
                </Button>
              </Link>
              <Button className="w-full bg-[#C96A52] hover:bg-[#C96A52]/90 h-12"
                onClick={() => {
                  if (challenge.courses_info?.length === 1) {
                    openAddRound(challenge.courses_info[0].course_id, user?.user_id);
                  } else {
                    // Show course selector
                    setShowAddRound('select');
                  }
                }}
                data-testid="add-round-btn">
                <Plus className="h-5 w-5 mr-2" />Add Round
              </Button>
            </div>
            <div className="bg-[#E8E9E3]/50 rounded-xl p-3">
              <p className="text-xs text-[#6B6E66] leading-relaxed">
                <strong className="text-[#1B3C35]">Play a Round</strong> — use the app live on the course. Birdies auto-track!
                <br /><strong className="text-[#1B3C35]">Add Round</strong> — enter scores from a past game.
              </p>
            </div>
          </>
        )}

        {/* Share */}
        {challenge.invite_code && isParticipant && (
          <Button variant="outline" className="w-full border-[#E2E3DD] h-10"
            onClick={() => {
              const url = `${window.location.origin}/challenges/join/${challenge.invite_code}`;
              if (navigator.share) {
                navigator.share({ title: challenge.name, text: `Join my Birdie Challenge!`, url });
              } else {
                navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!'));
              }
            }}
            data-testid="share-challenge-btn">
            <Share2 className="h-4 w-4 mr-2" />Share Invite Link
          </Button>
        )}
      </div>

      {/* Course selector for Add Round (when multiple courses) */}
      {showAddRound === 'select' && (
        <Card className="border-[#E2E3DD] shadow-none mb-5">
          <CardContent className="p-3">
            <p className="text-xs font-bold text-[#6B6E66] uppercase mb-2">Select Course</p>
            <div className="space-y-2">
              {challenge.courses_info?.map(c => (
                <Button key={c.course_id} variant="outline"
                  className="w-full justify-start border-[#E2E3DD] h-12"
                  onClick={() => openAddRound(c.course_id, user?.user_id)}>
                  <MapPin className="h-4 w-4 mr-2 text-[#6B6E66]" />{c.course_name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Leaderboard */}
      <Card className="border-[#E2E3DD] shadow-none mb-5">
        <CardHeader className="py-3 bg-[#1B3C35] rounded-t-xl">
          <CardTitle className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedParticipants.map((p, i) => {
            const pct = challenge.total_holes > 0 ? Math.round(((p.completed_holes || 0) / challenge.total_holes) * 100) : 0;
            return (
              <div key={p.user_id} className="px-4 py-3 border-b border-[#E2E3DD] last:border-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-bold text-[#1B3C35] w-6 tabular-nums">{i + 1}</span>
                    <span className="font-medium text-[#1B3C35] truncate">{p.player_name}</span>
                    {p.user_id === challenge.winner_id && <Trophy className="h-4 w-4 text-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-[#C96A52] tabular-nums">{p.completed_holes || 0}/{challenge.total_holes}</span>
                    {canManage && p.user_id !== user?.user_id && (
                      <button onClick={() => removePlayer(p.user_id, p.player_name)}
                        className={`${confirmDeleteId === p.user_id
                          ? 'px-2 h-7 rounded-full bg-red-500 text-white text-[10px] font-bold'
                          : 'w-7 h-7 rounded-full bg-red-50 text-red-400'} flex items-center justify-center active:scale-95 transition-all`}>
                        {confirmDeleteId === p.user_id ? 'Remove?' : <Trash2 className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-2.5 bg-[#E8E9E3] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: pct === 100 ? '#C96A52' : '#1B3C35' }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Course Progress */}
      {challenge.courses_info?.map(course => {
        return (
          <Card key={course.course_id} className="border-[#E2E3DD] shadow-none mb-4">
            <CardHeader className="py-2 px-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>{course.course_name}</p>
                <span className="text-[10px] text-[#6B6E66]">{course.holes?.length} holes</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E3DD]">
                      <th className="text-left py-1 px-1 text-[#6B6E66] font-bold w-20">Player</th>
                      {course.holes?.map(h => (
                        <th key={h.hole} className="py-1 px-0.5 text-center text-[#6B6E66] font-bold min-w-[1.6rem]">
                          {h.hole}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedParticipants.map(p => {
                      const birdied = new Set(
                        (p.birdied_holes || []).filter(b => b.course_id === course.course_id).map(b => b.hole_number)
                      );
                      return (
                        <tr key={p.user_id} className="border-b border-[#E2E3DD] last:border-0">
                          <td className="py-1 px-1 font-medium text-[#1B3C35] truncate max-w-[5rem]">{p.player_name}</td>
                          {course.holes?.map(h => (
                            <td key={h.hole} className="py-0.5 px-0.5 text-center">
                              {birdied.has(h.hole) ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#C96A52] text-white">
                                  <Check className="h-2.5 w-2.5" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E8E9E3] text-[#6B6E66] text-[9px]">
                                  {h.hole}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
