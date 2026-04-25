// Match — start screen (2-8 players, friendly single-round game).
// Pick opponents, format (stroke / best_ball / match_play), course + tee,
// and (for best_ball) split into two teams of 2.
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Swords, Send, User as UserIcon, X, Users } from 'lucide-react';
import { toast } from 'sonner';

const FORMATS = [
  { id: 'stroke', label: 'Stroke Play', desc: 'Lowest total strokes wins. 2-8 players.' },
  { id: 'match_play', label: 'Match Play', desc: 'Hole-by-hole 1v1. Exactly 2 players.' },
  { id: 'best_ball', label: 'Best Ball', desc: '2v2 teams, lower best-ball-per-hole. 4 players.' },
];

export default function NewMatch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [opponentQuery, setOpponentQuery] = useState('');
  const [opponentResults, setOpponentResults] = useState([]);
  const [opponents, setOpponents] = useState([]);          // selected opponents
  const [format, setFormat] = useState('stroke');
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [teeName, setTeeName] = useState('');
  const [numHoles, setNumHoles] = useState('18');
  const [team1, setTeam1] = useState([]);                  // user_ids for team 1
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/courses`).then(r => setCourses(r.data)).catch(() => {});
  }, []);

  // Debounced opponent search
  useEffect(() => {
    if (!opponentQuery || opponentQuery.length < 2) {
      setOpponentResults([]);
      return;
    }
    const t = setTimeout(() => {
      axios.get(`${API}/users/search?q=${encodeURIComponent(opponentQuery)}`)
        .then(r => {
          const filtered = (r.data || []).filter(u =>
            u.user_id !== user?.user_id &&
            !opponents.some(o => o.user_id === u.user_id)
          );
          setOpponentResults(filtered);
        })
        .catch(() => setOpponentResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [opponentQuery, opponents, user]);

  const course = courses.find(c => c.course_id === courseId);
  const tees = course?.tees || [];
  const totalPlayers = 1 + opponents.length;
  const allUserIds = useMemo(() => [user?.user_id, ...opponents.map(o => o.user_id)].filter(Boolean),
    [user, opponents]);

  // When format requires fewer/more players, give helpful UI hints
  const formatLimitsOk =
    (format === 'stroke' && totalPlayers >= 2 && totalPlayers <= 8) ||
    (format === 'match_play' && totalPlayers === 2) ||
    (format === 'best_ball' && totalPlayers === 4);

  // For best_ball, team1 must have exactly 2 valid user_ids (creator can be in either team)
  const teamsOk = format !== 'best_ball' || (team1.length === 2 && team1.every(uid => allUserIds.includes(uid)));

  const addOpponent = (u) => {
    setOpponents(prev => prev.length >= 7 ? prev : [...prev, u]);
    setOpponentQuery(''); setOpponentResults([]);
  };
  const removeOpponent = (uid) => {
    setOpponents(prev => prev.filter(o => o.user_id !== uid));
    setTeam1(prev => prev.filter(id => id !== uid));
  };
  const toggleTeam1 = (uid) => {
    setTeam1(prev => prev.includes(uid)
      ? prev.filter(id => id !== uid)
      : (prev.length >= 2 ? prev : [...prev, uid])
    );
  };

  const submit = async () => {
    if (!courseId || !teeName) { toast.error('Pick course and tee'); return; }
    if (!opponents.length) { toast.error('Add at least one opponent'); return; }
    if (!formatLimitsOk) { toast.error('Player count does not match the selected format'); return; }
    if (!teamsOk) { toast.error('For Best Ball, pick exactly 2 players for Team 1'); return; }
    setSubmitting(true);
    try {
      const payload = {
        opponent_ids: opponents.map(o => o.user_id),
        course_id: courseId,
        tee_name: teeName,
        num_holes: parseInt(numHoles, 10),
        format,
      };
      if (format === 'best_ball') {
        const team2_ids = allUserIds.filter(uid => !team1.includes(uid));
        payload.teams = [
          { name: 'Team 1', user_ids: team1 },
          { name: 'Team 2', user_ids: team2_ids },
        ];
      }
      const res = await axios.post(`${API}/matches`, payload);
      toast.success('Match created!');
      // Take creator straight into the round
      navigate(`/play/${courseId}?match=${res.data.tournament_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create match');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-xl mx-auto fade-in" data-testid="new-match-page">
      <Button variant="ghost" className="mb-3 text-[#6B6E66]" onClick={() => navigate('/dashboard')}
        data-testid="match-back-btn">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="mb-5">
        <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">Match</p>
        <h1 className="text-3xl font-bold text-[#1B3C35] flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
          <Swords className="h-8 w-8 text-[#C96A52]" /> Friendly Match
        </h1>
        <p className="text-sm text-[#6B6E66] mt-1">
          One round between friends. Picks counts in your stats.
        </p>
      </div>

      {/* Format */}
      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider">Format</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => setFormat(f.id)}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${format === f.id
                ? 'border-[#C96A52] bg-[#C96A52]/10' : 'border-[#E2E3DD]'}`}
              data-testid={`format-${f.id}`}>
              <p className="font-bold text-[#1B3C35]">{f.label}</p>
              <p className="text-xs text-[#6B6E66]">{f.desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Opponents */}
      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4" /> Players
            <span className="ml-auto text-[10px] font-normal text-[#6B6E66] normal-case tracking-normal">
              {totalPlayers} of {format === 'match_play' ? 2 : format === 'best_ball' ? 4 : 8}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Selected opponents */}
          {opponents.length > 0 && (
            <div className="space-y-2 mb-3" data-testid="selected-opponents">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[#1B3C35]/5">
                {user?.picture
                  ? <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
                  : <div className="h-8 w-8 rounded-full bg-[#C96A52]/20 flex items-center justify-center"><UserIcon className="h-4 w-4 text-[#C96A52]" /></div>}
                <div className="flex-1 text-sm font-bold text-[#1B3C35]">{user?.name} <span className="text-[10px] font-normal text-[#6B6E66] uppercase">you</span></div>
              </div>
              {opponents.map(o => (
                <div key={o.user_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#E8E9E3]/40" data-testid={`opponent-row-${o.user_id}`}>
                  {o.picture
                    ? <img src={o.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
                    : <div className="h-8 w-8 rounded-full bg-[#C96A52]/20 flex items-center justify-center"><UserIcon className="h-4 w-4 text-[#C96A52]" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B3C35] truncate">{o.name}</p>
                    <p className="text-[11px] text-[#6B6E66] truncate">{o.email}</p>
                  </div>
                  <button onClick={() => removeOpponent(o.user_id)}
                    className="h-7 w-7 rounded-full bg-white border border-[#E2E3DD] flex items-center justify-center"
                    data-testid={`remove-opponent-${o.user_id}`}>
                    <X className="h-3.5 w-3.5 text-[#6B6E66]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add more opponents */}
          {opponents.length < 7 && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6E66]" />
                <Input value={opponentQuery} onChange={e => setOpponentQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="pl-9 h-11 border-[#E2E3DD]"
                  data-testid="opponent-search-input"
                />
              </div>
              {opponentResults.length > 0 && (
                <div className="mt-2 border border-[#E2E3DD] rounded-lg max-h-56 overflow-y-auto divide-y divide-[#E2E3DD]">
                  {opponentResults.map(u => (
                    <button key={u.user_id} onClick={() => addOpponent(u)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-[#E8E9E3] text-left"
                      data-testid={`opponent-option-${u.user_id}`}>
                      {u.picture
                        ? <img src={u.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : <div className="h-8 w-8 rounded-full bg-[#C96A52]/20 flex items-center justify-center"><UserIcon className="h-4 w-4 text-[#C96A52]" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1B3C35] truncate">{u.name}</p>
                        <p className="text-[11px] text-[#6B6E66] truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {!formatLimitsOk && opponents.length > 0 && (
            <p className="mt-2 text-xs text-[#C96A52]" data-testid="format-mismatch-warn">
              {format === 'match_play' && 'Match Play needs exactly 2 players.'}
              {format === 'best_ball' && 'Best Ball needs exactly 4 players.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Teams (only Best Ball) */}
      {format === 'best_ball' && totalPlayers === 4 && (
        <Card className="border-[#E2E3DD] shadow-none mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider">Team 1 (pick 2)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[user, ...opponents].map(p => p && (
              <button key={p.user_id} onClick={() => toggleTeam1(p.user_id)}
                className={`w-full flex items-center gap-2 p-2.5 rounded-lg border-2 transition-colors ${team1.includes(p.user_id)
                  ? 'border-[#C96A52] bg-[#C96A52]/10' : 'border-[#E2E3DD]'}`}
                data-testid={`team1-toggle-${p.user_id}`}>
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center
                  ${team1.includes(p.user_id) ? 'border-[#C96A52] bg-[#C96A52]' : 'border-[#E2E3DD]'}`}>
                  {team1.includes(p.user_id) && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm font-medium text-[#1B3C35]">{p.name}</span>
              </button>
            ))}
            <p className="text-xs text-[#6B6E66] mt-1">The other 2 will be Team 2.</p>
          </CardContent>
        </Card>
      )}

      {/* Course */}
      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider">Course</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-[#6B6E66]">Course</Label>
            <Select value={courseId} onValueChange={(v) => { setCourseId(v); setTeeName(''); }}>
              <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="match-course-select">
                <SelectValue placeholder="Pick a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(c => (
                  <SelectItem key={c.course_id} value={c.course_id}>
                    {c.course_name || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {course && (
            <div>
              <Label className="text-xs text-[#6B6E66]">Tee</Label>
              <Select value={teeName} onValueChange={setTeeName}>
                <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="match-tee-select">
                  <SelectValue placeholder="Pick a tee" />
                </SelectTrigger>
                <SelectContent>
                  {tees.map((t, i) => (
                    <SelectItem key={i} value={t.name}>
                      {t.name}{t.total_yardage ? ` · ${t.total_yardage}y` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Holes */}
      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider">Holes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setNumHoles('9')}
              className={`py-3 rounded-lg border-2 transition-colors ${numHoles === '9'
                ? 'border-[#C96A52] bg-[#C96A52]/10 text-[#C96A52]' : 'border-[#E2E3DD] text-[#6B6E66]'}`}
              data-testid="match-9-holes">
              <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'Outfit' }}>9</p>
              <p className="text-[10px] uppercase tracking-wider">Front 9</p>
            </button>
            <button
              onClick={() => setNumHoles('18')}
              className={`py-3 rounded-lg border-2 transition-colors ${numHoles === '18'
                ? 'border-[#C96A52] bg-[#C96A52]/10 text-[#C96A52]' : 'border-[#E2E3DD] text-[#6B6E66]'}`}
              data-testid="match-18-holes">
              <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'Outfit' }}>18</p>
              <p className="text-[10px] uppercase tracking-wider">Full round</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4">
        <Button
          className="w-full h-12 bg-[#C96A52] hover:bg-[#C96A52]/90 shadow-lg"
          onClick={submit}
          disabled={submitting || !opponents.length || !courseId || !teeName || !formatLimitsOk || !teamsOk}
          data-testid="match-send-btn">
          <Send className="h-4 w-4 mr-2" />
          {submitting ? 'Sending…' : `Send to ${opponents.length} player${opponents.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  );
}
