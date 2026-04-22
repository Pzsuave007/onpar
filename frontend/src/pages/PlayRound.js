import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Save, Flag, MapPin, Target, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';

const TEE_COLORS = {
  black: 'bg-gray-900 text-white',
  blue: 'bg-blue-600 text-white',
  white: 'bg-white text-gray-900 border border-gray-300',
  gold: 'bg-amber-400 text-amber-900',
  red: 'bg-red-500 text-white',
  green: 'bg-green-600 text-white',
  default: 'bg-[#1B3C35] text-white',
};

function getTeeStyle(color) {
  return TEE_COLORS[color?.toLowerCase()] || TEE_COLORS.default;
}

export default function PlayRound() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTee, setSelectedTee] = useState(null);
  const [holes, setHoles] = useState([]);
  const [roundId, setRoundId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [birdieAlerts, setBirdieAlerts] = useState([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [showFullCard, setShowFullCard] = useState(false);

  useEffect(() => {
    axios.get(`${API}/courses`).then(res => {
      setCourses(res.data);
      if (courseId) {
        const c = res.data.find(x => x.course_id === courseId);
        if (c) setSelectedCourse(c);
      }
    }).catch(() => toast.error('Failed to load courses')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Auto-initialize scorecard for legacy courses that have flat holes but no tees structure.
  // Must be declared at the top level (before any early returns) to keep hook order stable.
  useEffect(() => {
    if (selectedCourse && !selectedTee && !holes.length && (!selectedCourse.tees || selectedCourse.tees.length === 0) && selectedCourse.holes?.length) {
      const fallbackHoles = selectedCourse.holes.map(h => ({ hole: h.hole, par: h.par, strokes: 0, toPar: '', yardage: h.yardage || 0 }));
      setHoles(fallbackHoles);
      setSelectedTee({ name: 'Default', color: 'white', holes: selectedCourse.holes });
    }
  }, [selectedCourse, selectedTee, holes.length]);

  const selectTee = (tee) => {
    setSelectedTee(tee);
    setHoles(tee.holes.map(h => ({ hole: h.hole, par: h.par, strokes: 0, toPar: '', yardage: h.yardage || 0 })));
    setRoundId(null);
    setBirdieAlerts([]);
    setCurrentHoleIndex(0);
  };

  // Directly set strokes for a hole (used by the +/- stepper).
  const setHoleStrokes = (index, strokes) => {
    setHoles(prev => {
      const updated = [...prev];
      const h = updated[index];
      const clamped = Math.max(0, Math.min(15, strokes));
      updated[index] = { ...h, strokes: clamped, toPar: clamped === 0 ? '' : clamped - h.par };
      return updated;
    });
  };

  // Relative-to-par entry: user types -1 for birdie, 0 for par, +1 for bogey.
  // We translate that to absolute strokes for backend compatibility. Used by the grid input.
  const updateHole = (index, toParInput) => {
    setHoles(prev => {
      const updated = [...prev];
      const h = updated[index];
      const raw = String(toParInput).trim();
      if (raw === '' || raw === '-' || raw === '+') {
        updated[index] = { ...h, toPar: raw, strokes: 0 };
        return updated;
      }
      const rel = parseInt(raw, 10);
      if (Number.isNaN(rel) || rel < -4 || rel > 10) return prev;
      const strokes = Math.max(1, h.par + rel);
      updated[index] = { ...h, toPar: rel, strokes };
      return updated;
    });
  };

  const saveRound = async (finish = false) => {
    setSaving(true);
    try {
      const res = await axios.post(`${API}/rounds`, {
        course_id: selectedCourse.course_id, round_id: roundId, holes, finish
      });
      setRoundId(res.data.round_id);
      const newBirdies = res.data.new_challenge_birdies || [];
      if (newBirdies.length > 0) {
        setBirdieAlerts(prev => [...prev, ...newBirdies]);
        newBirdies.forEach(b => {
          toast.success(`Birdie on hole ${b.hole}! Marked in "${b.challenge}"`, { duration: 4000 });
        });
      } else {
        toast.success(finish ? 'Round complete!' : 'Saved!');
      }
      if (finish) navigate('/play');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading...</div>
      </div>
    );
  }

  // Step 1: Course selector
  if (!selectedCourse) {
    return (
      <div className="min-h-screen p-6 md:p-8 max-w-3xl mx-auto fade-in" data-testid="play-round-select">
        <div className="mb-8">
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">Play</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Select Course
          </h1>
          <p className="text-sm text-[#6B6E66] mt-1">Choose the course you're playing today</p>
        </div>
        {courses.length === 0 ? (
          <Card className="border-[#E2E3DD] shadow-none">
            <CardContent className="py-12 text-center">
              <MapPin className="h-10 w-10 text-[#D6D7D2] mx-auto mb-3" />
              <p className="text-[#6B6E66] mb-2">No courses saved yet</p>
              <p className="text-sm text-[#6B6E66]">Go to Admin → Courses to scan a scorecard</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {courses.map(c => (
              <Card key={c.course_id}
                className="border-[#E2E3DD] shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                onClick={() => setSelectedCourse(c)} data-testid={`select-course-${c.course_id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-[#1B3C35] text-lg flex-1 min-w-0">{c.course_name}</h3>
                    <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 shrink-0" size="sm">
                      <Flag className="h-4 w-4 mr-1" />Play
                    </Button>
                  </div>
                  <p className="text-sm text-[#6B6E66]">{c.num_holes} holes</p>
                  {c.tees && c.tees.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {c.tees.map((t, i) => (
                        <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${getTeeStyle(t.color)}`}>
                          {t.name} &middot; {t.total_yardage || '?'}y &middot; Par {t.total_par}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2: Tee selector (if course has multiple tees)
  const tees = selectedCourse.tees || [];
  if (tees.length > 0 && !selectedTee) {
    return (
      <div className="min-h-screen p-6 md:p-8 max-w-3xl mx-auto fade-in" data-testid="play-tee-select">
        <Button variant="ghost" size="sm" className="mb-4 text-[#6B6E66]"
          onClick={() => setSelectedCourse(null)} data-testid="back-to-courses">
          <ArrowLeft className="h-4 w-4 mr-1" /> Change Course
        </Button>
        <div className="mb-8">
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">{selectedCourse.course_name}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Select Your Tee
          </h1>
          <p className="text-sm text-[#6B6E66] mt-1">Which tees are you playing from?</p>
        </div>
        <div className="space-y-3">
          {tees.map((tee, i) => (
            <Card key={i}
              className="border-[#E2E3DD] shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              onClick={() => selectTee(tee)} data-testid={`select-tee-${tee.color || i}`}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getTeeStyle(tee.color)}`}>
                  <Flag className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#1B3C35] text-lg">{tee.name}</h3>
                  <p className="text-sm text-[#6B6E66]">
                    {tee.total_yardage ? `${tee.total_yardage} yards` : ''} &middot; Par {tee.total_par}
                  </p>
                </div>
                <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 shrink-0" size="sm">Select</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Step 3: Scorecard entry (mobile-first hole-by-hole carousel)
  const played = holes.filter(h => h.strokes > 0);
  const totalStrokes = played.reduce((s, h) => s + h.strokes, 0);
  const totalPar = played.reduce((s, h) => s + h.par, 0);
  const toPar = totalStrokes - totalPar;
  const allFilled = holes.length > 0 && holes.every(h => h.strokes > 0);
  const front9 = holes.slice(0, Math.min(9, holes.length));
  const back9 = holes.length > 9 ? holes.slice(9) : [];
  const front9Done = front9.length > 0 && front9.every(h => h.strokes > 0);
  const canFinish = allFilled || (front9Done && back9.length > 0);
  const birdieCount = played.filter(h => h.strokes < h.par).length;
  const formatScore = (s) => s === 0 ? 'E' : s > 0 ? `+${s}` : `${s}`;
  const scoreClr = (s) => s < 0 ? 'text-[#C96A52]' : s > 0 ? 'text-[#1D2D44]' : 'text-[#4A5D23]';

  const currentHole = holes[currentHoleIndex];
  const currentDiff = currentHole && currentHole.strokes > 0 ? currentHole.strokes - currentHole.par : null;
  let holeBg = 'bg-white';
  let scoreLabel = '';
  if (currentDiff !== null) {
    if (currentDiff <= -2) { holeBg = 'bg-amber-50'; scoreLabel = 'Eagle!'; }
    else if (currentDiff === -1) { holeBg = 'bg-[#C96A52]/10'; scoreLabel = 'Birdie!'; }
    else if (currentDiff === 0) { holeBg = 'bg-[#4A5D23]/10'; scoreLabel = 'Par'; }
    else if (currentDiff === 1) { holeBg = 'bg-[#1D2D44]/10'; scoreLabel = 'Bogey'; }
    else { holeBg = 'bg-[#1D2D44]/15'; scoreLabel = `+${currentDiff}`; }
  }

  return (
    <div className="min-h-screen p-3 sm:p-6 max-w-lg mx-auto fade-in" data-testid="play-round">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={() => { setSelectedTee(null); setHoles([]); setRoundId(null); setCurrentHoleIndex(0); }}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="back-to-tees">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[10px] tracking-[0.15em] uppercase font-bold text-[#C96A52]">Now Playing</p>
          <p className="text-sm font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>
            {selectedCourse.course_name}
          </p>
          <p className="text-[10px] text-[#6B6E66]">
            {selectedTee?.name} Tees · Par {selectedTee?.total_par || selectedCourse.total_par}
          </p>
        </div>
        <button onClick={() => setShowFullCard(true)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="view-full-card-btn" aria-label="View full scorecard">
          <LayoutGrid className="h-5 w-5" />
        </button>
      </div>

      {/* Birdie alerts */}
      {birdieAlerts.length > 0 && (
        <div className="mb-3 p-2.5 bg-[#C96A52]/10 border border-[#C96A52]/20 rounded-lg">
          <div className="flex items-center gap-2 text-[#C96A52] font-bold text-xs">
            <Target className="h-3.5 w-3.5" />
            {birdieAlerts.length} birdie(s) marked in challenges!
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {birdieAlerts.map((b, i) => (
              <Badge key={i} className="bg-[#C96A52] text-white text-[10px]">
                Hole {b.hole} → {b.challenge}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 mb-3 bg-[#E8E9E3]/50 rounded-xl p-2.5">
        <div className="text-center">
          <p className="text-[9px] text-[#6B6E66] uppercase font-bold tracking-wider">Total</p>
          <p className="text-lg font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>
            {totalStrokes || '–'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-[#6B6E66] uppercase font-bold tracking-wider">To Par</p>
          <p className={`text-lg font-bold tabular-nums ${played.length > 0 ? scoreClr(toPar) : 'text-[#6B6E66]'}`} style={{ fontFamily: 'Outfit' }}>
            {played.length > 0 ? formatScore(toPar) : '–'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-[#6B6E66] uppercase font-bold tracking-wider">Played</p>
          <p className="text-lg font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>
            {played.length}/{holes.length}
          </p>
        </div>
      </div>

      {/* Hole dots (tap to jump) */}
      <div className="flex gap-1 justify-center mb-3 flex-wrap">
        {holes.map((h, i) => {
          const diff = h.strokes > 0 ? h.strokes - h.par : null;
          let dotColor = 'bg-[#E2E3DD]';
          if (i === currentHoleIndex) dotColor = 'bg-[#1B3C35] ring-2 ring-[#1B3C35]/30';
          else if (diff !== null) {
            if (diff < 0) dotColor = 'bg-[#C96A52]';
            else if (diff === 0) dotColor = 'bg-[#4A5D23]';
            else dotColor = 'bg-[#1D2D44]';
          }
          const dotLabel = diff === null ? '' : (diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`);
          return (
            <button key={i} onClick={() => setCurrentHoleIndex(i)}
              className={`w-6 h-6 rounded-full ${dotColor} text-[9px] font-bold text-white flex items-center justify-center active:scale-90`}
              data-testid={`play-dot-${h.hole}`}>
              {dotLabel}
            </button>
          );
        })}
      </div>

      {/* Current hole card (big stepper) */}
      {currentHole && (
        <Card className={`border-[#E2E3DD] shadow-none ${holeBg} transition-colors`}>
          <CardContent className="py-7 px-4">
            <div className="text-center mb-5">
              <p className="text-[10px] text-[#6B6E66] uppercase font-bold tracking-widest">Hole</p>
              <p className="text-5xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>{currentHole.hole}</p>
              <p className="text-sm text-[#6B6E66] mt-1">
                Par {currentHole.par}{currentHole.yardage ? ` · ${currentHole.yardage}y` : ''}
              </p>
            </div>
            {scoreLabel && (
              <p className={`text-center text-base font-bold mb-3 ${currentDiff < 0 ? 'text-[#C96A52]' : currentDiff === 0 ? 'text-[#4A5D23]' : 'text-[#1D2D44]'}`}>
                {scoreLabel}
              </p>
            )}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => {
                  const next = currentHole.strokes === 0 ? Math.max(1, currentHole.par - 1) : Math.max(1, currentHole.strokes - 1);
                  setHoleStrokes(currentHoleIndex, next);
                }}
                className="w-16 h-16 rounded-full bg-[#1B3C35] text-white text-3xl font-bold flex items-center justify-center active:scale-90 transition-transform"
                data-testid={`play-minus-${currentHole.hole}`}>
                −
              </button>
              <span className="text-5xl font-bold text-[#1B3C35] w-20 text-center tabular-nums" style={{ fontFamily: 'Outfit' }}
                data-testid={`play-score-${currentHole.hole}`}>
                {currentHole.strokes === 0
                  ? '–'
                  : (currentHole.strokes === currentHole.par
                    ? '0'
                    : currentHole.strokes > currentHole.par
                      ? `+${currentHole.strokes - currentHole.par}`
                      : `${currentHole.strokes - currentHole.par}`)}
              </span>
              <button
                onClick={() => {
                  const next = currentHole.strokes === 0 ? currentHole.par : Math.min(15, currentHole.strokes + 1);
                  setHoleStrokes(currentHoleIndex, next);
                }}
                className="w-16 h-16 rounded-full bg-[#C96A52] text-white text-3xl font-bold flex items-center justify-center active:scale-90 transition-transform"
                data-testid={`play-plus-${currentHole.hole}`}>
                +
              </button>
            </div>
            <p className="text-center text-[11px] text-[#6B6E66] mt-3">
              {currentHole.strokes > 0 ? `${currentHole.strokes} strokes` : 'Tap + for par · − for birdie'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Prev / Next nav */}
      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" className="border-[#E2E3DD] h-12 px-4"
          disabled={currentHoleIndex === 0}
          onClick={() => setCurrentHoleIndex(currentHoleIndex - 1)}
          data-testid="play-prev-hole">
          <ChevronLeft className="h-5 w-5 mr-1" />Prev
        </Button>
        <span className="text-sm text-[#6B6E66] tabular-nums">{currentHoleIndex + 1} / {holes.length}</span>
        {currentHoleIndex < holes.length - 1 ? (
          <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12 px-4"
            onClick={() => setCurrentHoleIndex(currentHoleIndex + 1)}
            data-testid="play-next-hole">
            Next<ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        ) : (
          <Button className="bg-[#C96A52] hover:bg-[#C96A52]/90 h-12 px-4" onClick={() => saveRound(true)}
            disabled={saving || !canFinish} data-testid="finish-round-btn">
            <Flag className="h-5 w-5 mr-1" />{saving ? 'Saving...' : (allFilled ? 'Finish' : front9Done ? 'Finish 9' : `${played.length}/${holes.length}`)}
          </Button>
        )}
      </div>

      {/* Save progress + badges */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <Button variant="outline" className="flex-1 border-[#E2E3DD] h-10"
          onClick={() => saveRound(false)} disabled={saving} data-testid="save-round-btn">
          <Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save Progress'}
        </Button>
        {birdieCount > 0 && (
          <Badge className="bg-[#C96A52] text-white text-xs h-10 px-3">
            <Target className="h-3.5 w-3.5 mr-1" />{birdieCount} Birdie{birdieCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Full scorecard modal (read-only grid view) */}
      <Dialog open={showFullCard} onOpenChange={setShowFullCard}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Full Scorecard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {[{ set: front9, label: 'Front 9', out: 'OUT' }, ...(back9.length > 0 ? [{ set: back9, label: 'Back 9', out: 'IN' }] : [])].map(group => {
              const setTotal = group.set.filter(h => h.strokes > 0).reduce((s, h) => s + h.strokes, 0);
              const setPar = group.set.reduce((s, h) => s + h.par, 0);
              return (
                <div key={group.label}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider">{group.label}</h3>
                    <span className="text-[10px] text-[#6B6E66]">Par {setPar} · Total {setTotal || '–'}</span>
                  </div>
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${group.set.length}, 1fr) 2.5rem` }}>
                    {group.set.map(h => (
                      <div key={`n${h.hole}`} className="text-center text-[9px] text-[#6B6E66] font-bold">{h.hole}</div>
                    ))}
                    <div className="text-center text-[9px] text-[#1B3C35] font-bold bg-[#E8E9E3] rounded">{group.out}</div>
                    {group.set.map(h => (
                      <div key={`p${h.hole}`} className="text-center text-[9px] text-[#6B6E66]">P{h.par}</div>
                    ))}
                    <div className="text-center text-[9px] text-[#6B6E66] font-bold bg-[#E8E9E3] rounded">{setPar}</div>
                    {group.set.map((h) => {
                      const diff = h.strokes > 0 ? h.strokes - h.par : null;
                      let bg = 'bg-white border-[#E2E3DD] text-[#6B6E66]';
                      if (diff !== null) {
                        if (diff <= -2) bg = 'bg-amber-100 border-amber-300 text-amber-700';
                        else if (diff === -1) bg = 'bg-[#C96A52]/15 border-[#C96A52]/40 text-[#C96A52]';
                        else if (diff === 0) bg = 'bg-[#4A5D23]/10 border-[#4A5D23]/30 text-[#4A5D23]';
                        else bg = 'bg-[#1D2D44]/10 border-[#1D2D44]/30 text-[#1D2D44]';
                      }
                      return (
                        <div key={h.hole}
                          className={`h-9 text-center text-xs font-bold rounded border ${bg} flex items-center justify-center`}>
                          {h.strokes > 0 ? h.strokes : '–'}
                        </div>
                      );
                    })}
                    <div className="h-9 flex items-center justify-center text-xs font-bold text-[#1B3C35] bg-[#E8E9E3] rounded tabular-nums">
                      {setTotal || '–'}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-[#E2E3DD] flex items-center justify-between text-sm">
              <span className="font-bold text-[#1B3C35]">Round Total</span>
              <span className="font-bold text-[#1B3C35] tabular-nums">
                {totalStrokes || '–'}{played.length > 0 ? ` (${formatScore(toPar)})` : ''}
              </span>
            </div>
            <p className="text-[10px] text-center text-[#6B6E66]">
              Tap a hole number on the main screen to jump to it.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
