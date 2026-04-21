import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save, Flag, MapPin, Target } from 'lucide-react';

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

  const selectTee = (tee) => {
    setSelectedTee(tee);
    setHoles(tee.holes.map(h => ({ hole: h.hole, par: h.par, strokes: 0, toPar: '', yardage: h.yardage || 0 })));
    setRoundId(null);
    setBirdieAlerts([]);
  };

  // Relative-to-par entry: user types -1 for birdie, 0 for par, +1 for bogey.
  // We translate that to absolute strokes for backend compatibility.
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

  // Auto-initialize scorecard for legacy courses without tees
  useEffect(() => {
    if (selectedCourse && !selectedTee && !holes.length && (!selectedCourse.tees || selectedCourse.tees.length === 0) && selectedCourse.holes?.length) {
      const fallbackHoles = selectedCourse.holes.map(h => ({ hole: h.hole, par: h.par, strokes: 0, toPar: '', yardage: h.yardage || 0 }));
      setHoles(fallbackHoles);
      setSelectedTee({ name: 'Default', color: 'white', holes: selectedCourse.holes });
    }
  }, [selectedCourse, selectedTee, holes.length]);

  // Step 3: Scorecard entry
  const front9 = holes.slice(0, Math.min(9, holes.length));
  const back9 = holes.length > 9 ? holes.slice(9) : [];
  const played = holes.filter(h => h.strokes > 0);
  const totalStrokes = played.reduce((s, h) => s + h.strokes, 0);
  const totalPar = played.reduce((s, h) => s + h.par, 0);
  const toPar = totalStrokes - totalPar;
  const allFilled = holes.length > 0 && holes.every(h => h.strokes > 0);
  const front9Done = front9.length > 0 && front9.every(h => h.strokes > 0);
  const canFinish = allFilled || (front9Done && back9.length > 0);
  const birdieCount = played.filter(h => h.strokes < h.par).length;
  const formatScore = (s) => s === 0 ? 'E' : s > 0 ? `+${s}` : `${s}`;
  const scoreClr = (s) => s < 0 ? 'text-[#C96A52]' : s > 0 ? 'text-[#1D2D44]' : 'text-[#4A5D23]';

  const HoleGrid = ({ holeSet, label, startIdx }) => {
    const setTotal = holeSet.filter(h => h.strokes > 0).reduce((s, h) => s + h.strokes, 0);
    const setPar = holeSet.reduce((s, h) => s + h.par, 0);
    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider">{label}</h3>
          <span className="text-[10px] text-[#6B6E66]">-1 birdie · 0 par · +1 bogey</span>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${holeSet.length}, 1fr) 2.5rem` }}>
          {holeSet.map(h => (
            <div key={`n${h.hole}`} className="text-center text-[9px] text-[#6B6E66] font-bold">{h.hole}</div>
          ))}
          <div className="text-center text-[9px] text-[#1B3C35] font-bold bg-[#E8E9E3] rounded">
            {label === 'Front 9' ? 'OUT' : 'IN'}
          </div>
          {holeSet.map(h => (
            <div key={`p${h.hole}`} className="text-center text-[9px] text-[#6B6E66]">P{h.par}</div>
          ))}
          <div className="text-center text-[9px] text-[#6B6E66] font-bold bg-[#E8E9E3] rounded">{setPar}</div>
          {holeSet.map(h => (
            <div key={`y${h.hole}`} className="text-center text-[8px] text-[#6B6E66]/60">{h.yardage || ''}</div>
          ))}
          <div className="text-center text-[8px] text-[#6B6E66]/60 bg-[#E8E9E3] rounded">
            {holeSet.reduce((s, h) => s + (h.yardage || 0), 0) || ''}
          </div>
          {holeSet.map((h, i) => {
            const idx = startIdx + i;
            const diff = h.strokes > 0 ? h.strokes - h.par : null;
            let bg = 'bg-white border-[#E2E3DD]';
            if (diff !== null) {
              if (diff <= -2) bg = 'bg-amber-100 border-amber-300 text-amber-700';
              else if (diff === -1) bg = 'bg-[#C96A52]/15 border-[#C96A52]/40 text-[#C96A52]';
              else if (diff === 0) bg = 'bg-[#4A5D23]/10 border-[#4A5D23]/30 text-[#4A5D23]';
              else bg = 'bg-[#1D2D44]/10 border-[#1D2D44]/30 text-[#1D2D44]';
            }
            return (
              <input key={h.hole} type="number" step="1" min="-4" max="10"
                value={h.toPar === '' || h.toPar === undefined ? '' : h.toPar}
                onChange={e => updateHole(idx, e.target.value)}
                placeholder="–"
                className={`w-full h-10 text-center text-sm font-bold rounded border ${bg} focus:ring-2 focus:ring-[#1B3C35] focus:outline-none`}
                data-testid={`play-hole-${h.hole}`} />
            );
          })}
          <div className="h-10 flex items-center justify-center text-sm font-bold text-[#1B3C35] bg-[#E8E9E3] rounded tabular-nums">
            {setTotal || '-'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-4xl mx-auto fade-in" data-testid="play-round">
      <Button variant="ghost" size="sm" className="mb-3 text-[#6B6E66]"
        onClick={() => { setSelectedTee(null); setHoles([]); setRoundId(null); }} data-testid="back-to-tees">
        <ArrowLeft className="h-4 w-4 mr-1" /> Change Tee
      </Button>

      {birdieAlerts.length > 0 && (
        <div className="mb-4 p-3 bg-[#C96A52]/10 border border-[#C96A52]/20 rounded-lg">
          <div className="flex items-center gap-2 text-[#C96A52] font-bold text-sm">
            <Target className="h-4 w-4" />
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

      <Card className="border-[#E2E3DD] shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-bold text-[#C96A52]">Now Playing</p>
              <CardTitle className="text-xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                {selectedCourse.course_name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {selectedTee && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getTeeStyle(selectedTee.color)}`}>
                    {selectedTee.name} Tees
                  </span>
                )}
                <span className="text-sm text-[#6B6E66]">
                  Par {selectedTee?.total_par || selectedCourse.total_par}
                  {selectedTee?.total_yardage ? ` · ${selectedTee.total_yardage}y` : ''}
                </span>
              </div>
            </div>
            {birdieCount > 0 && (
              <Badge className="bg-[#C96A52] text-white text-xs">
                <Target className="h-3 w-3 mr-1" />{birdieCount} Birdie{birdieCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <HoleGrid holeSet={front9} label="Front 9" startIdx={0} />
          {back9.length > 0 && <HoleGrid holeSet={back9} label="Back 9" startIdx={9} />}

          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[#E2E3DD]">
            <div>
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">Total</p>
              <p className="text-2xl font-bold text-[#1B3C35] tabular-nums">{totalStrokes || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">To Par</p>
              <p className={`text-2xl font-bold tabular-nums ${played.length > 0 ? scoreClr(toPar) : 'text-[#6B6E66]'}`}>
                {played.length > 0 ? formatScore(toPar) : '-'}
              </p>
            </div>
            <div className="text-xs text-[#6B6E66]">{played.length}/{holes.length} holes</div>
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <Button variant="outline" className="border-[#E2E3DD] text-[#1B3C35]" onClick={() => saveRound(false)}
              disabled={saving} data-testid="save-round-btn">
              <Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save'}
            </Button>
            <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={() => saveRound(true)}
              disabled={saving || !canFinish} data-testid="finish-round-btn">
              <Flag className="h-4 w-4 mr-1" />
              {allFilled ? 'Finish Round' : front9Done ? 'Finish 9 Holes' : `${played.length}/${holes.length} Holes`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
