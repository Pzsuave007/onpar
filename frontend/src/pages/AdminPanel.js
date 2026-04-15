import { useState, useEffect } from 'react';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Play, CheckCircle, Users, Trophy, Radio, Share2, Camera, MapPin, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRef } from 'react';

const DEFAULT_PAR = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4];
const DEFAULT_PAR_9 = [4, 3, 5, 4, 4, 3, 4, 5, 4];

const statusConfig = {
  upcoming: { label: 'Upcoming', class: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
  active: { label: 'Active', class: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' },
  completed: { label: 'Completed', class: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100' },
};

const emptyForm = {
  name: '', course_name: '', start_date: '', end_date: '',
  scoring_format: 'stroke', num_holes: 18,
  par_per_hole: [...DEFAULT_PAR], max_players: 100, description: ''
};

export default function AdminPanel() {
  const [tournaments, setTournaments] = useState([]);
  const [players, setPlayers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  // Course scanning
  const [scanning, setScanning] = useState(false);
  const [scannedCourse, setScannedCourse] = useState(null);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const fileInputRef = useRef(null);

  const fetchTournaments = () => axios.get(`${API}/tournaments`).then(r => setTournaments(r.data));
  const fetchPlayers = () => axios.get(`${API}/players`).then(r => setPlayers(r.data));
  const fetchCourses = () => axios.get(`${API}/courses`).then(r => setCourses(r.data));

  useEffect(() => {
    fetchTournaments().catch(() => toast.error('Failed to load tournaments'));
    fetchPlayers().catch(() => {});
    fetchCourses().catch(() => {});
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setShowDialog(true);
  };

  const openEdit = (t) => {
    setEditId(t.tournament_id);
    setForm({
      name: t.name, course_name: t.course_name, start_date: t.start_date,
      end_date: t.end_date, scoring_format: t.scoring_format, num_holes: t.num_holes,
      num_rounds: t.num_rounds || 1,
      par_per_hole: [...t.par_per_hole], max_players: t.max_players, description: t.description || ''
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.course_name || !form.start_date || !form.end_date) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`${API}/tournaments/${editId}`, {
          name: form.name, course_name: form.course_name, start_date: form.start_date,
          end_date: form.end_date, scoring_format: form.scoring_format,
          num_rounds: form.num_rounds, max_players: form.max_players, description: form.description
        });
        toast.success('Tournament updated');
      } else {
        await axios.post(`${API}/tournaments`, form);
        toast.success('Tournament created');
      }
      setShowDialog(false);
      fetchTournaments();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tid) => {
    if (!window.confirm('Delete this tournament and all its scorecards?')) return;
    try {
      await axios.delete(`${API}/tournaments/${tid}`);
      toast.success('Tournament deleted');
      fetchTournaments();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleStatus = async (tid, status) => {
    try {
      await axios.put(`${API}/tournaments/${tid}`, { status });
      toast.success(`Tournament ${status}`);
      fetchTournaments();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleRole = async (userId, role) => {
    try {
      await axios.put(`${API}/players/${userId}/role`, { role });
      toast.success('Role updated');
      fetchPlayers();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleHolesChange = (numHoles) => {
    const n = parseInt(numHoles);
    setForm(prev => ({
      ...prev, num_holes: n,
      par_per_hole: n === 9 ? [...DEFAULT_PAR_9] : [...DEFAULT_PAR]
    }));
  };

  const updatePar = (index, val) => {
    const v = parseInt(val) || 3;
    if (v < 3 || v > 6) return;
    const updated = [...form.par_per_hole];
    updated[index] = v;
    setForm(prev => ({ ...prev, par_per_hole: updated }));
  };

  const handleScanPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const res = await axios.post(`${API}/courses/scan`, { image_base64: base64 });
      setScannedCourse(res.data);
      setShowCourseDialog(true);
      toast.success('Scorecard scanned!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Scan failed. Try a clearer photo.');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveCourse = async () => {
    if (!scannedCourse) return;
    setSaving(true);
    try {
      await axios.post(`${API}/courses`, scannedCourse);
      toast.success('Course saved!');
      setShowCourseDialog(false);
      setScannedCourse(null);
      fetchCourses();
    } catch (err) {
      toast.error('Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (courseId) => {
    if (!window.confirm('Delete this course?')) return;
    try {
      await axios.delete(`${API}/courses/${courseId}`);
      toast.success('Course deleted');
      fetchCourses();
    } catch { toast.error('Failed to delete'); }
  };

  const applyCourseToForm = (course) => {
    setForm(prev => ({
      ...prev,
      course_name: course.course_name,
      num_holes: course.num_holes,
      par_per_hole: course.holes.map(h => h.par)
    }));
    toast.success(`Applied ${course.course_name}`);
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto fade-in" data-testid="admin-panel">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
          Admin Panel
        </h1>
        <p className="text-[#6B6E66] mt-1">Manage tournaments and players</p>
      </div>

      <Tabs defaultValue="tournaments" className="space-y-6">
        <TabsList className="bg-[#E8E9E3]">
          <TabsTrigger value="tournaments" data-testid="admin-tournaments-tab">
            <Trophy className="h-4 w-4 mr-1" />Tournaments
          </TabsTrigger>
          <TabsTrigger value="courses" data-testid="admin-courses-tab">
            <MapPin className="h-4 w-4 mr-1" />Courses
          </TabsTrigger>
          <TabsTrigger value="players" data-testid="admin-players-tab">
            <Users className="h-4 w-4 mr-1" />Players
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>All Tournaments</h2>
            <Button onClick={openCreate} className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" data-testid="create-tournament-btn">
              <Plus className="h-4 w-4 mr-1" />New Tournament
            </Button>
          </div>
          {tournaments.length === 0 ? (
            <Card className="border-[#E2E3DD] shadow-none">
              <CardContent className="py-12 text-center text-[#6B6E66]">
                No tournaments yet. Create your first one!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tournaments.map(t => (
                <Card key={t.tournament_id} className="border-[#E2E3DD] shadow-none hover:shadow-md transition-shadow"
                  data-testid={`admin-tournament-${t.tournament_id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-[#1B3C35]">{t.name}</h3>
                          <Badge className={statusConfig[t.status]?.class}>{statusConfig[t.status]?.label}</Badge>
                          <Badge variant="outline" className="capitalize text-[10px]">{t.scoring_format}</Badge>
                        </div>
                        <p className="text-sm text-[#6B6E66] mt-1">
                          {t.course_name} &middot; {t.start_date} to {t.end_date} &middot; Par {t.total_par} &middot; {t.num_holes} holes
                          {(t.num_rounds || 1) > 1 ? ` &middot; ${t.num_rounds} rounds` : ''}
                          &middot; <Users className="inline h-3 w-3" /> {t.participant_count || 0} players
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {t.status === 'upcoming' && (
                          <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => handleStatus(t.tournament_id, 'active')} data-testid={`activate-btn-${t.tournament_id}`}>
                            <Play className="h-3.5 w-3.5 mr-1" />Activate
                          </Button>
                        )}
                        {t.status === 'active' && (
                          <>
                            <Link to={`/keeper/${t.tournament_id}`} data-testid={`live-score-btn-${t.tournament_id}`}>
                              <Button size="sm" className="bg-[#C96A52] hover:bg-[#C96A52]/90 text-white">
                                <Radio className="h-3.5 w-3.5 mr-1" />Live Scorer
                              </Button>
                            </Link>
                            <Button size="sm" variant="outline" className="border-[#1B3C35] text-[#1B3C35] hover:bg-[#E8E9E3]"
                              onClick={() => {
                                const url = `${window.location.origin}/leaderboard/${t.tournament_id}`;
                                navigator.clipboard.writeText(url).then(() => toast.success('Link copied! Share it with your family'));
                              }} data-testid={`share-btn-${t.tournament_id}`}>
                              <Share2 className="h-3.5 w-3.5 mr-1" />Share
                            </Button>
                            <Button size="sm" variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-50"
                              onClick={() => handleStatus(t.tournament_id, 'completed')} data-testid={`complete-btn-${t.tournament_id}`}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />Complete
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline" className="border-[#E2E3DD]" onClick={() => openEdit(t)}
                          data-testid={`edit-btn-${t.tournament_id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(t.tournament_id)} data-testid={`delete-btn-${t.tournament_id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>


        <TabsContent value="courses">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>Golf Courses</h2>
            <div>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef}
                onChange={handleScanPhoto} className="hidden" data-testid="scan-file-input" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={scanning}
                className="bg-[#C96A52] hover:bg-[#C96A52]/90 text-white" data-testid="scan-scorecard-btn">
                {scanning ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Scanning...</> :
                  <><Camera className="h-4 w-4 mr-1" />Scan Scorecard</>}
              </Button>
            </div>
          </div>
          {courses.length === 0 ? (
            <Card className="border-[#E2E3DD] shadow-none">
              <CardContent className="py-12 text-center">
                <Camera className="h-10 w-10 text-[#D6D7D2] mx-auto mb-3" />
                <p className="text-[#6B6E66] mb-2">No courses saved yet</p>
                <p className="text-sm text-[#6B6E66]">Take a photo of a scorecard to add a course automatically</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {courses.map(c => (
                <Card key={c.course_id} className="border-[#E2E3DD] shadow-none" data-testid={`course-card-${c.course_id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-[#1B3C35]">{c.course_name}</h3>
                        <p className="text-sm text-[#6B6E66] mt-1">
                          {c.num_holes} holes &middot; Par {c.total_par}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.holes?.map(h => (
                            <span key={h.hole} className="text-[10px] bg-[#E8E9E3] rounded px-1.5 py-0.5 tabular-nums text-[#1B3C35]">
                              H{h.hole}:P{h.par}{h.yardage > 0 ? `/${h.yardage}y` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="border-[#E2E3DD] text-[#1B3C35]"
                          onClick={() => { applyCourseToForm(c); setShowDialog(true); }}
                          data-testid={`use-course-btn-${c.course_id}`}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Use
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => deleteCourse(c.course_id)} data-testid={`delete-course-${c.course_id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="players">
          <Card className="border-[#E2E3DD] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                Registered Players ({players.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#E8E9E3]/40 hover:bg-[#E8E9E3]/40">
                    <TableHead className="font-bold text-[#1B3C35]">Name</TableHead>
                    <TableHead className="font-bold text-[#1B3C35]">Email</TableHead>
                    <TableHead className="font-bold text-[#1B3C35]">Role</TableHead>
                    <TableHead className="font-bold text-[#1B3C35] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map(p => (
                    <TableRow key={p.user_id} data-testid={`player-row-${p.user_id}`}>
                      <TableCell className="font-medium text-[#1B3C35]">{p.name}</TableCell>
                      <TableCell className="text-[#6B6E66]">{p.email}</TableCell>
                      <TableCell>
                        <Badge variant={p.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                          {p.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost"
                          onClick={() => handleRole(p.user_id, p.role === 'admin' ? 'player' : 'admin')}
                          data-testid={`toggle-role-${p.user_id}`}>
                          {p.role === 'admin' ? 'Demote' : 'Promote'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>{editId ? 'Edit Tournament' : 'Create Tournament'}</DialogTitle>
            <DialogDescription>Fill in the tournament details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#1B3C35]">Tournament Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="mt-1 border-[#E2E3DD]" placeholder="Spring Classic" data-testid="form-name" />
              </div>
              <div>
                <Label className="text-[#1B3C35]">Course Name *</Label>
                {!editId && courses.length > 0 && (
                  <Select onValueChange={cid => { const c = courses.find(x => x.course_id === cid); if (c) applyCourseToForm(c); }}>
                    <SelectTrigger className="mt-1 mb-1 border-[#E2E3DD] bg-[#E8E9E3]/30" data-testid="form-select-course">
                      <SelectValue placeholder="Load from saved course..." />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(c => (
                        <SelectItem key={c.course_id} value={c.course_id}>{c.course_name} (Par {c.total_par})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input value={form.course_name} onChange={e => setForm({ ...form, course_name: e.target.value })}
                  className="mt-1 border-[#E2E3DD]" placeholder="Augusta National" data-testid="form-course" />
              </div>
              <div>
                <Label className="text-[#1B3C35]">Start Date *</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="mt-1 border-[#E2E3DD]" data-testid="form-start-date" />
              </div>
              <div>
                <Label className="text-[#1B3C35]">End Date *</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                  className="mt-1 border-[#E2E3DD]" data-testid="form-end-date" />
              </div>
              <div>
                <Label className="text-[#1B3C35]">Scoring Format</Label>
                <Select value={form.scoring_format} onValueChange={v => setForm({ ...form, scoring_format: v })}>
                  <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="form-scoring-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stroke">Stroke Play</SelectItem>
                    <SelectItem value="stableford">Stableford</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!editId && (
                <div>
                  <Label className="text-[#1B3C35]">Number of Holes</Label>
                  <Select value={String(form.num_holes)} onValueChange={handleHolesChange}>
                    <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="form-num-holes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9">9 Holes</SelectItem>
                      <SelectItem value="18">18 Holes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-[#1B3C35]">Number of Rounds</Label>
                <Select value={String(form.num_rounds)} onValueChange={v => setForm({ ...form, num_rounds: parseInt(v) })}>
                  <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="form-num-rounds">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Round</SelectItem>
                    <SelectItem value="2">2 Rounds</SelectItem>
                    <SelectItem value="3">3 Rounds</SelectItem>
                    <SelectItem value="4">4 Rounds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[#1B3C35]">Max Players</Label>
                <Input type="number" value={form.max_players}
                  onChange={e => setForm({ ...form, max_players: parseInt(e.target.value) || 100 })}
                  className="mt-1 border-[#E2E3DD]" data-testid="form-max-players" />
              </div>
            </div>

            {!editId && (
              <div>
                <Label className="text-[#1B3C35] mb-2 block">Par per Hole (Total: {form.par_per_hole.reduce((a, b) => a + b, 0)})</Label>
                <div className="grid grid-cols-9 gap-2">
                  {form.par_per_hole.map((p, i) => (
                    <div key={i} className="text-center">
                      <span className="text-[10px] text-[#6B6E66] font-bold block mb-1">{i + 1}</span>
                      <Input type="number" min="3" max="6" value={p}
                        onChange={e => updatePar(i, e.target.value)}
                        className="text-center h-9 border-[#E2E3DD] px-1"
                        data-testid={`par-input-${i + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-[#1B3C35]">Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="mt-1 border-[#E2E3DD]" placeholder="Optional description" data-testid="form-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} data-testid="form-cancel-btn">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1B3C35] hover:bg-[#1B3C35]/90"
              data-testid="form-save-btn">
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scanned Course Review Dialog */}
      <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Review Scanned Course</DialogTitle>
            <DialogDescription>Verify the extracted data. All tees from the scorecard are shown.</DialogDescription>
          </DialogHeader>
          {scannedCourse && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-[#1B3C35]">Course Name</Label>
                <Input value={scannedCourse.course_name}
                  onChange={e => setScannedCourse({ ...scannedCourse, course_name: e.target.value })}
                  className="mt-1 border-[#E2E3DD]" data-testid="scanned-course-name" />
              </div>
              {/* Show tees */}
              {(scannedCourse.tees || []).map((tee, tIdx) => (
                <div key={tIdx} className="border border-[#E2E3DD] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full ${tee.color === 'white' ? 'bg-white border border-gray-300' : tee.color === 'blue' ? 'bg-blue-600' : tee.color === 'red' || tee.color === 'gold' ? 'bg-amber-400' : tee.color === 'black' ? 'bg-gray-900' : 'bg-[#1B3C35]'}`} />
                    <Input value={tee.name} onChange={e => {
                      const t = [...scannedCourse.tees]; t[tIdx] = { ...t[tIdx], name: e.target.value };
                      setScannedCourse({ ...scannedCourse, tees: t });
                    }} className="h-8 w-32 border-[#E2E3DD] font-bold" />
                    <span className="text-xs text-[#6B6E66]">
                      Par {tee.holes?.reduce((s, h) => s + (h.par || 0), 0)} &middot; {tee.total_yardage || '?'}y &middot; {tee.holes?.length} holes
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="flex gap-1 min-w-max text-[10px]">
                      <span className="w-10 text-[#6B6E66] font-bold">Hole</span>
                      {tee.holes?.map(h => <span key={h.hole} className="w-12 text-center text-[#6B6E66] font-bold">{h.hole}</span>)}
                    </div>
                    <div className="flex gap-1 min-w-max text-[10px] mt-0.5">
                      <span className="w-10 text-[#6B6E66]">Par</span>
                      {tee.holes?.map((h, hIdx) => (
                        <input key={hIdx} type="number" min="3" max="6" value={h.par}
                          onChange={e => {
                            const t = [...scannedCourse.tees]; const hs = [...t[tIdx].holes];
                            hs[hIdx] = { ...hs[hIdx], par: parseInt(e.target.value) || 3 };
                            t[tIdx] = { ...t[tIdx], holes: hs };
                            setScannedCourse({ ...scannedCourse, tees: t });
                          }}
                          className="w-12 h-7 text-center text-xs border border-[#E2E3DD] rounded" />
                      ))}
                    </div>
                    <div className="flex gap-1 min-w-max text-[10px] mt-0.5">
                      <span className="w-10 text-[#6B6E66]">Yds</span>
                      {tee.holes?.map((h, hIdx) => (
                        <input key={hIdx} type="number" min="0" value={h.yardage || 0}
                          onChange={e => {
                            const t = [...scannedCourse.tees]; const hs = [...t[tIdx].holes];
                            hs[hIdx] = { ...hs[hIdx], yardage: parseInt(e.target.value) || 0 };
                            t[tIdx] = { ...t[tIdx], holes: hs };
                            setScannedCourse({ ...scannedCourse, tees: t });
                          }}
                          className="w-12 h-7 text-center text-xs border border-[#E2E3DD] rounded" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {/* Fallback for old format */}
              {(!scannedCourse.tees || scannedCourse.tees.length === 0) && scannedCourse.holes && (
                <p className="text-sm text-[#6B6E66]">Old format detected. {scannedCourse.holes.length} holes.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourseDialog(false)}>Cancel</Button>
            <Button onClick={saveCourse} disabled={saving} className="bg-[#1B3C35] hover:bg-[#1B3C35]/90"
              data-testid="save-course-btn">
              {saving ? 'Saving...' : 'Save Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
