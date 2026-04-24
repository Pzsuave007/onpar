// 1v1 Quick Match — start screen
// Pick opponent (from registered users), course, tee, number of holes,
// then send challenge.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Swords, Send, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function NewMatch1v1() {
  const navigate = useNavigate();
  const [opponentQuery, setOpponentQuery] = useState('');
  const [opponentResults, setOpponentResults] = useState([]);
  const [opponent, setOpponent] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [teeName, setTeeName] = useState('');
  const [numHoles, setNumHoles] = useState('18');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/courses`).then(r => setCourses(r.data)).catch(() => {});
  }, []);

  // Debounced opponent search
  useEffect(() => {
    if (opponent) return;
    if (!opponentQuery || opponentQuery.length < 2) {
      setOpponentResults([]);
      return;
    }
    const t = setTimeout(() => {
      axios.get(`${API}/users/search?q=${encodeURIComponent(opponentQuery)}`)
        .then(r => setOpponentResults(r.data || []))
        .catch(() => setOpponentResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [opponentQuery, opponent]);

  const course = courses.find(c => c.course_id === courseId);
  const tees = course?.tees || [];

  const submit = async () => {
    if (!opponent || !courseId || !teeName) {
      toast.error('Pick opponent, course, and tee');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/matches/1v1`, {
        opponent_id: opponent.user_id,
        course_id: courseId,
        tee_name: teeName,
        num_holes: parseInt(numHoles, 10),
      });
      toast.success(`Challenge sent to ${opponent.name}!`);
      // Take challenger straight into the round
      navigate(`/play/${courseId}?match=${res.data.tournament_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create match');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-xl mx-auto fade-in" data-testid="new-1v1-page">
      <Button variant="ghost" className="mb-3 text-[#6B6E66]" onClick={() => navigate('/dashboard')}
        data-testid="match-back-btn">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="mb-5">
        <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">Quick Match</p>
        <h1 className="text-3xl font-bold text-[#1B3C35] flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
          <Swords className="h-8 w-8 text-[#C96A52]" /> 1v1 Stroke Play
        </h1>
        <p className="text-sm text-[#6B6E66] mt-1">
          Challenge a friend. Lower total strokes wins. Result counts in your head-to-head.
        </p>
      </div>

      {/* Opponent picker */}
      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider">Opponent</CardTitle>
        </CardHeader>
        <CardContent>
          {opponent ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1B3C35]/5 border border-[#E2E3DD]"
              data-testid="opponent-selected">
              {opponent.picture
                ? <img src={opponent.picture} alt="" className="h-10 w-10 rounded-full object-cover" />
                : <div className="h-10 w-10 rounded-full bg-[#C96A52]/20 flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-[#C96A52]" />
                  </div>}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1B3C35] truncate">{opponent.name}</p>
                <p className="text-xs text-[#6B6E66] truncate">{opponent.email}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setOpponent(null); setOpponentQuery(''); }}
                data-testid="opponent-change-btn">Change</Button>
            </div>
          ) : (
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
                    <button key={u.user_id} onClick={() => { setOpponent(u); setOpponentResults([]); }}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-[#E8E9E3] text-left"
                      data-testid={`opponent-option-${u.user_id}`}>
                      {u.picture
                        ? <img src={u.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : <div className="h-8 w-8 rounded-full bg-[#C96A52]/20 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-[#C96A52]" />
                          </div>}
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
        </CardContent>
      </Card>

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
          disabled={submitting || !opponent || !courseId || !teeName}
          data-testid="match-send-btn">
          <Send className="h-4 w-4 mr-2" />
          {submitting ? 'Sending…' : 'Send Challenge'}
        </Button>
      </div>
    </div>
  );
}
