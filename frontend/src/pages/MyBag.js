// "My Bag" page — personal club distances + Caddie calibration so club
// suggestions on /play adjust for current altitude and temperature.
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Trash2, ArrowLeft, Save, GripVertical, MountainSnow, Thermometer } from 'lucide-react';

export default function MyBag() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [calibration, setCalibration] = useState({ altitude_ft: 0, temp_f: 70 });
  const [homeCourseId, setHomeCourseId] = useState('');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [clubsRes, coursesRes] = await Promise.all([
          axios.get(`${API}/profile/clubs`),
          axios.get(`${API}/courses`),
        ]);
        setClubs(clubsRes.data.clubs || []);
        if (clubsRes.data.bag_calibration) setCalibration(clubsRes.data.bag_calibration);
        if (clubsRes.data.home_course_id) setHomeCourseId(clubsRes.data.home_course_id);
        setCourses(coursesRes.data || []);
      } catch {
        toast.error('Failed to load your bag');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateClub = (i, patch) => {
    setClubs(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c));
    setDirty(true);
  };
  const bumpDistance = (i, delta) =>
    updateClub(i, { distance_yards: Math.max(0, Math.min(400, (Number(clubs[i].distance_yards) || 0) + delta)) });

  const removeClub = (i) => {
    setClubs(cs => cs.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const addClub = () => {
    setClubs(cs => [...cs, { name: '', distance_yards: 0 }]);
    setDirty(true);
  };
  const moveClub = (from, to) => {
    if (to < 0 || to >= clubs.length) return;
    setClubs(cs => {
      const next = [...cs];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
    setDirty(true);
  };

  // When user picks a home course we offer to auto-fill calibration altitude
  // from Open-Meteo (the same source the Caddie uses on the course).
  const pickHomeCourse = async (courseId) => {
    setHomeCourseId(courseId);
    setDirty(true);
    if (!courseId) return;
    const c = courses.find(x => x.course_id === courseId);
    const lat = c?.holes?.[0]?.green_lat || c?.tees?.[0]?.holes?.[0]?.green_lat;
    const lng = c?.holes?.[0]?.green_lng || c?.tees?.[0]?.holes?.[0]?.green_lng;
    if (!lat || !lng) {
      toast.message('Set the altitude manually — this course has no GPS yet.');
      return;
    }
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&current=temperature_2m&temperature_unit=fahrenheit`
      );
      const j = await r.json();
      if (j?.elevation != null) {
        const ft = Math.round(j.elevation * 3.281);
        setCalibration(cal => ({ ...cal, altitude_ft: ft }));
        toast.success(`Calibrated to ${c.course_name}: ${ft} ft`);
      }
    } catch {
      toast.message('Could not auto-detect altitude.');
    }
  };

  const setCal = (patch) => {
    setCalibration(c => ({ ...c, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    const cleaned = clubs
      .map(c => ({ name: (c.name || '').trim(), distance_yards: Number(c.distance_yards) || 0 }))
      .filter(c => c.name.length > 0);
    if (cleaned.length === 0) {
      toast.error('Add at least one club');
      return;
    }
    setSaving(true);
    try {
      const r = await axios.put(`${API}/profile/clubs`, {
        clubs: cleaned,
        bag_calibration: {
          altitude_ft: Number(calibration.altitude_ft) || 0,
          temp_f: Number(calibration.temp_f) || 70,
        },
        home_course_id: homeCourseId || '',
      });
      setClubs(r.data.clubs);
      if (r.data.bag_calibration) setCalibration(r.data.bag_calibration);
      setDirty(false);
      toast.success('✓ Bag saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <p className="text-[#6B6E66] text-sm animate-pulse">Loading bag…</p>
    </div>;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto fade-in" data-testid="my-bag-page">
      <Button variant="ghost" className="mb-4 text-[#6B6E66]"
        onClick={() => navigate('/dashboard')} data-testid="my-bag-back-btn">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            🏌️ My Bag
          </CardTitle>
          <p className="text-xs text-[#6B6E66]">
            Average yardage with each club. The Caddie on /play adjusts these for altitude + temperature
            so you get a realistic suggestion at any course.
          </p>
        </CardHeader>
      </Card>

      {/* Caddie Calibration */}
      <Card className="border-[#E2E3DD] shadow-none mb-4" data-testid="caddie-calibration-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider flex items-center gap-2">
            🧢 Caddie Calibration
          </CardTitle>
          <p className="text-[11px] text-[#6B6E66]">
            <b>Today's altitude and temperature always come from the course you're playing</b>{' '}
            (live, from weather + GPS). These two values just describe where you measured your
            normal distances, so the Caddie knows your baseline.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-[#6B6E66]">Course where you measured (optional)</Label>
            <Select value={homeCourseId} onValueChange={pickHomeCourse}>
              <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="home-course-select">
                <SelectValue placeholder="Pick your usual course (auto-fills altitude)" />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[#6B6E66] flex items-center gap-1">
                <MountainSnow className="h-3 w-3" /> Altitude when measured (ft)
              </Label>
              <Input type="number" inputMode="numeric"
                value={calibration.altitude_ft ?? 0}
                onChange={e => setCal({ altitude_ft: parseInt(e.target.value || '0', 10) })}
                className="mt-1 h-10 text-center text-base font-bold text-[#1B3C35] tabular-nums border-[#E2E3DD]"
                data-testid="calibration-altitude-input"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B6E66] flex items-center gap-1">
                <Thermometer className="h-3 w-3" /> Avg temp when measured (°F)
              </Label>
              <Input type="number" inputMode="numeric"
                value={calibration.temp_f ?? 70}
                onChange={e => setCal({ temp_f: parseInt(e.target.value || '70', 10) })}
                className="mt-1 h-10 text-center text-base font-bold text-[#1B3C35] tabular-nums border-[#E2E3DD]"
                data-testid="calibration-temp-input"
              />
            </div>
          </div>
          <p className="text-[10px] text-[#6B6E66]">
            Sea level / 70°F defaults are fine if you measured on a mild day at low elevation.
          </p>
        </CardContent>
      </Card>

      {/* Clubs list */}
      <Card className="border-[#E2E3DD] shadow-none">
        <CardContent className="p-2">
          <div className="divide-y divide-[#E2E3DD]">
            {clubs.map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-1" data-testid={`my-bag-row-${i}`}>
                <div className="flex flex-col">
                  <button className="text-[#6B6E66] hover:text-[#1B3C35] disabled:opacity-30 p-0.5"
                    onClick={() => moveClub(i, i - 1)} disabled={i === 0}
                    aria-label="Move up" data-testid={`my-bag-up-${i}`}>
                    <GripVertical className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  value={c.name}
                  onChange={e => updateClub(i, { name: e.target.value })}
                  placeholder="Club (e.g. 7i)"
                  className="h-10 flex-1 border-[#E2E3DD] font-medium"
                  maxLength={20}
                  data-testid={`my-bag-name-${i}`}
                />
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline"
                    className="h-10 w-10 border-[#E2E3DD] shrink-0"
                    onClick={() => bumpDistance(i, -5)}
                    data-testid={`my-bag-minus-${i}`}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="w-20 text-center">
                    <Input type="number" inputMode="numeric"
                      value={c.distance_yards || ''}
                      onChange={e => updateClub(i, { distance_yards: parseInt(e.target.value || '0', 10) })}
                      className="h-10 text-center text-lg font-bold text-[#1B3C35] tabular-nums border-[#E2E3DD]"
                      data-testid={`my-bag-dist-${i}`}
                    />
                    <span className="text-[10px] text-[#6B6E66] uppercase tracking-wider">yards</span>
                  </div>
                  <Button size="icon" variant="outline"
                    className="h-10 w-10 border-[#E2E3DD] shrink-0"
                    onClick={() => bumpDistance(i, 5)}
                    data-testid={`my-bag-plus-${i}`}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button size="icon" variant="ghost"
                  className="h-10 w-10 text-[#C96A52] hover:bg-[#C96A52]/10 shrink-0"
                  onClick={() => removeClub(i)}
                  data-testid={`my-bag-delete-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline"
            className="w-full mt-3 border-dashed border-[#C96A52]/40 text-[#C96A52] hover:bg-[#C96A52]/5"
            onClick={addClub}
            data-testid="my-bag-add-btn">
            <Plus className="h-4 w-4 mr-1" /> Add club
          </Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 mt-4 flex justify-end">
        <Button
          className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 shadow-lg"
          onClick={save}
          disabled={saving || !dirty}
          data-testid="my-bag-save-btn">
          <Save className="h-4 w-4 mr-1" />
          {saving ? 'Saving…' : dirty ? 'Save bag' : 'Saved ✓'}
        </Button>
      </div>
    </div>
  );
}
