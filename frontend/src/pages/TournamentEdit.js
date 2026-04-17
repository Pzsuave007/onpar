import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, Lock, Globe } from 'lucide-react';

export default function TournamentEdit() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const isNew = tournamentId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', course_name: '', start_date: '', end_date: '',
    scoring_format: 'stroke', num_rounds: 1, max_players: 100,
    num_holes: 18, par_per_hole: [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
    description: '', visibility: 'private'
  });

  useEffect(() => {
    if (isNew) return;
    axios.get(`${API}/tournaments/${tournamentId}`).then(res => {
      const t = res.data;
      setForm({
        name: t.name || '', course_name: t.course_name || '',
        start_date: t.start_date || '', end_date: t.end_date || '',
        scoring_format: t.scoring_format || 'stroke',
        num_rounds: t.num_rounds || 1, max_players: t.max_players || 100,
        num_holes: t.num_holes || 18, par_per_hole: t.par_per_hole || [],
        description: t.description || '', visibility: t.visibility || 'private'
      });
    }).catch(() => toast.error('Tournament not found'))
      .finally(() => setLoading(false));
  }, [tournamentId, isNew]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        await axios.post(`${API}/tournaments`, form);
        toast.success('Tournament created!');
      } else {
        await axios.put(`${API}/tournaments/${tournamentId}`, {
          name: form.name, course_name: form.course_name,
          start_date: form.start_date, end_date: form.end_date,
          scoring_format: form.scoring_format, num_rounds: form.num_rounds,
          max_players: form.max_players, description: form.description,
          visibility: form.visibility
        });
        toast.success('Tournament updated!');
      }
      navigate('/admin');
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

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto" data-testid="tournament-edit">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="back-btn">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
          {isNew ? 'New Tournament' : 'Edit Tournament'}
        </h1>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Tournament Name</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="mt-1 border-[#E2E3DD] h-12 text-base" data-testid="edit-name" />
        </div>

        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Course</Label>
          <Input value={form.course_name} onChange={e => setForm({ ...form, course_name: e.target.value })}
            className="mt-1 border-[#E2E3DD] h-12 text-base" data-testid="edit-course" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[#1B3C35] text-sm font-bold">Start Date</Label>
            <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
              className="mt-1 border-[#E2E3DD] h-12" data-testid="edit-start" />
          </div>
          <div>
            <Label className="text-[#1B3C35] text-sm font-bold">End Date</Label>
            <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
              className="mt-1 border-[#E2E3DD] h-12" data-testid="edit-end" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[#1B3C35] text-sm font-bold">Scoring</Label>
            <Select value={form.scoring_format} onValueChange={v => setForm({ ...form, scoring_format: v })}>
              <SelectTrigger className="mt-1 border-[#E2E3DD] h-12" data-testid="edit-scoring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stroke">Stroke Play</SelectItem>
                <SelectItem value="stableford">Stableford</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[#1B3C35] text-sm font-bold">Rounds</Label>
            <Select value={String(form.num_rounds)} onValueChange={v => setForm({ ...form, num_rounds: parseInt(v) })}>
              <SelectTrigger className="mt-1 border-[#E2E3DD] h-12" data-testid="edit-rounds">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n} Round{n>1?'s':''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Visibility</Label>
          <Select value={form.visibility} onValueChange={v => setForm({ ...form, visibility: v })}>
            <SelectTrigger className="mt-1 border-[#E2E3DD] h-12" data-testid="edit-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">
                <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Private</span>
              </SelectItem>
              <SelectItem value="public">
                <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Public</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Max Players</Label>
          <Input type="number" value={form.max_players}
            onChange={e => setForm({ ...form, max_players: parseInt(e.target.value) || 100 })}
            className="mt-1 border-[#E2E3DD] h-12 text-base" data-testid="edit-max" />
        </div>

        <div>
          <Label className="text-[#1B3C35] text-sm font-bold">Description</Label>
          <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="mt-1 border-[#E2E3DD] h-12 text-base" placeholder="Optional"
            data-testid="edit-description" />
        </div>

        <Button onClick={handleSave} disabled={saving}
          className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-14 text-base mt-4"
          data-testid="save-tournament-btn">
          <Save className="h-5 w-5 mr-2" />{saving ? 'Saving...' : isNew ? 'Create Tournament' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
