// Full-page setup for Virtual Tournaments (replaces the former dialog).
// Creator can set name, description, rounds, format, visibility, dates, max players,
// and optionally a suggested default course to pre-assign to joining players.
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import DatePicker from '@/components/DatePicker';
import { toast } from 'sonner';
import { ArrowLeft, Save, Lock, Globe, Flag } from 'lucide-react';

export default function VirtualTournamentEdit() {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const isNew = !tourId || tourId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    name: '', description: '',
    num_rounds: 5, scoring_format: 'stroke',
    visibility: 'private',
    start_date: '', end_date: '',
    max_players: 100,
    suggested_course_id: '',
    suggested_course_name: ''
  });

  useEffect(() => {
    axios.get(`${API}/courses`).then(res => setCourses(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    axios.get(`${API}/tours/${tourId}`).then(res => {
      const t = res.data;
      setForm({
        name: t.name || '',
        description: t.description || '',
        num_rounds: t.num_rounds || 5,
        scoring_format: t.scoring_format || 'stroke',
        visibility: t.visibility || 'private',
        start_date: t.start_date || '',
        end_date: t.end_date || '',
        max_players: t.max_players || 100,
        suggested_course_id: t.suggested_course_id || '',
        suggested_course_name: t.suggested_course_name || ''
      });
    }).catch(() => toast.error('Tournament not found'))
      .finally(() => setLoading(false));
  }, [tourId, isNew]);

  const pickCourse = (courseId) => {
    if (courseId === 'none') {
      setForm(prev => ({ ...prev, suggested_course_id: '', suggested_course_name: '' }));
      return;
    }
    const c = courses.find(x => x.course_id === courseId);
    if (!c) return;
    setForm(prev => ({ ...prev, suggested_course_id: c.course_id, suggested_course_name: c.course_name }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const res = await axios.post(`${API}/tours`, form);
        toast.success('Virtual Tournament created!');
        const newId = res.data.tour_id;
        if (newId) navigate(`/tours/${newId}`);
      } else {
        await axios.put(`${API}/tours/${tourId}`, form);
        toast.success('Tournament updated!');
        navigate(`/tours/${tourId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-[#1B3C35]">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto" data-testid="virtual-tournament-edit">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="vt-back-btn">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#C96A52]">Virtual Tournament</p>
          <h1 className="text-xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            {isNew ? 'New Virtual Tournament' : 'Edit Tournament'}
          </h1>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Tournament Name</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Summer Club Challenge"
            className="mt-1 border-[#E2E3DD] h-12 text-base" data-testid="vt-name" />
        </div>

        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Description</Label>
          <Textarea value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Rules, prizes, or extra info (optional)"
            className="mt-1 border-[#E2E3DD] text-base min-h-[80px]" data-testid="vt-description" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[#1B3C35] text-sm font-bold">Rounds</Label>
            <Select value={String(form.num_rounds)}
              onValueChange={v => setForm({ ...form, num_rounds: parseInt(v) })}>
              <SelectTrigger className="mt-1 border-[#E2E3DD] h-12" data-testid="vt-rounds">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n =>
                  <SelectItem key={n} value={String(n)}>{n} Round{n > 1 ? 's' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[#1B3C35] text-sm font-bold">Scoring</Label>
            <Select value={form.scoring_format}
              onValueChange={v => setForm({ ...form, scoring_format: v })}>
              <SelectTrigger className="mt-1 border-[#E2E3DD] h-12" data-testid="vt-scoring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stroke">Stroke Play</SelectItem>
                <SelectItem value="stableford">Stableford</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[#1B3C35] text-sm font-bold">Start Date</Label>
            <DatePicker value={form.start_date} onChange={v => setForm({ ...form, start_date: v })}
              placeholder="Select start date" className="mt-1 w-full" testId="vt-start" />
          </div>
          <div>
            <Label className="text-[#1B3C35] text-sm font-bold">End Date</Label>
            <DatePicker value={form.end_date} onChange={v => setForm({ ...form, end_date: v })}
              placeholder="Select end date" className="mt-1 w-full" testId="vt-end" />
          </div>
        </div>

        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Visibility</Label>
          <Select value={form.visibility} onValueChange={v => setForm({ ...form, visibility: v })}>
            <SelectTrigger className="mt-1 border-[#E2E3DD] h-12" data-testid="vt-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">
                <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Private (invite only)</span>
              </SelectItem>
              <SelectItem value="public">
                <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Public</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Max Players</Label>
          <Input type="number" min="2" max="500" value={form.max_players}
            onChange={e => setForm({ ...form, max_players: parseInt(e.target.value) || 100 })}
            className="mt-1 border-[#E2E3DD] h-12 text-base" data-testid="vt-max-players" />
        </div>

        <div>
          <Label className="text-[#1B3C35] text-sm font-bold flex items-center gap-1">
            <Flag className="h-3.5 w-3.5" /> Default Course (Optional)
          </Label>
          <Select value={form.suggested_course_id || 'none'} onValueChange={pickCourse}>
            <SelectTrigger className="mt-1 border-[#E2E3DD] h-12" data-testid="vt-course">
              <SelectValue placeholder={courses.length ? 'Pick a default course...' : 'No courses in DB'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— No default (players pick their own) —</SelectItem>
              {courses.map(c => (
                <SelectItem key={c.course_id} value={c.course_id}>
                  {c.course_name} {c.num_holes ? `· ${c.num_holes} holes` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-[#6B6E66] mt-1">
            Players can still override and pick their own course when they join.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}
          className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-14 text-base mt-4"
          data-testid="vt-save-btn">
          <Save className="h-5 w-5 mr-2" />
          {saving ? 'Saving...' : isNew ? 'Create Virtual Tournament' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
