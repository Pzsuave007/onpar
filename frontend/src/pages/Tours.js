// Unified Tournaments page: shows Local Tournaments (tournaments collection)
// and Virtual Tournaments (tours collection) side by side with filters.
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Globe, Users, ChevronRight, Hash, Share2, Lock, Trophy, MapPin, Calendar } from 'lucide-react';

function TypeBadge({ type }) {
  if (type === 'local') {
    return (
      <Badge className="bg-[#1B3C35] text-white hover:bg-[#1B3C35] text-[10px]">
        <MapPin className="h-3 w-3 mr-0.5" />Local
      </Badge>
    );
  }
  return (
    <Badge className="bg-[#C96A52] text-white hover:bg-[#C96A52] text-[10px]">
      <Globe className="h-3 w-3 mr-0.5" />Virtual
    </Badge>
  );
}

export default function Tournaments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [locals, setLocals] = useState([]);
  const [virtuals, setVirtuals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | local | virtual

  // Virtual create dialog
  const [showPicker, setShowPicker] = useState(false);
  const [showCreateVirtual, setShowCreateVirtual] = useState(false);
  const [name, setName] = useState('');
  const [numRounds, setNumRounds] = useState('5');
  const [scoringFormat, setScoringFormat] = useState('stroke');
  const [visibility, setVisibility] = useState('private');
  const [creating, setCreating] = useState(false);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/tournaments`).catch(() => ({ data: [] })),
      axios.get(`${API}/tours`).catch(() => ({ data: [] })),
    ]).then(([tRes, vRes]) => {
      setLocals(tRes.data || []);
      setVirtuals(vRes.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const createVirtual = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      await axios.post(`${API}/tours`, {
        name: name.trim(), num_rounds: parseInt(numRounds),
        scoring_format: scoringFormat, visibility
      });
      toast.success('Virtual Tournament created!');
      setShowCreateVirtual(false);
      setName(''); setVisibility('private');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setCreating(false); }
  };

  const shareVirtual = (tour) => {
    const url = `${window.location.origin}/tours/join/${tour.invite_code}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!'));
  };

  const shareLocal = (t) => {
    const url = t.invite_code
      ? `${window.location.origin}/tournaments/join/${t.invite_code}`
      : `${window.location.origin}/leaderboard/${t.tournament_id}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!'));
  };

  // Build unified list
  const items = [];
  for (const t of locals) {
    items.push({
      kind: 'local',
      id: t.tournament_id,
      name: t.name,
      status: t.status || 'active',
      visibility: t.visibility || 'private',
      scoring_format: t.scoring_format,
      num_rounds: t.num_rounds || 1,
      course_name: t.course_name,
      start_date: t.start_date,
      participants_count: t.participant_count || t.players_count || t.num_registered || 0,
      raw: t
    });
  }
  for (const v of virtuals) {
    items.push({
      kind: 'virtual',
      id: v.tour_id,
      name: v.name,
      status: v.status || 'active',
      visibility: v.visibility || 'private',
      scoring_format: v.scoring_format,
      num_rounds: v.num_rounds,
      participants_count: v.participants?.length || 0,
      raw: v
    });
  }

  const filtered = items.filter(i => filter === 'all' ? true : i.kind === filter);
  filtered.sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-[#1B3C35]">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto fade-in" data-testid="tournaments-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">Compete</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Tournaments
          </h1>
          <p className="text-sm text-[#6B6E66] mt-1">
            Play local (same day, same course) or virtual (everyone plays their own course).
          </p>
        </div>
        {user && (
          <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90"
            onClick={() => (isAdmin ? setShowPicker(true) : setShowCreateVirtual(true))}
            data-testid="create-tournament-btn">
            <Plus className="h-4 w-4 mr-1" />New Tournament
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter} className="mb-5">
        <TabsList className="bg-[#E8E9E3]">
          <TabsTrigger value="all" data-testid="tournaments-filter-all">All</TabsTrigger>
          <TabsTrigger value="local" data-testid="tournaments-filter-local">
            <MapPin className="h-3.5 w-3.5 mr-1" />Local
          </TabsTrigger>
          <TabsTrigger value="virtual" data-testid="tournaments-filter-virtual">
            <Globe className="h-3.5 w-3.5 mr-1" />Virtual
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="py-16 text-center">
            <Trophy className="h-12 w-12 text-[#D6D7D2] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#1B3C35] mb-2" style={{ fontFamily: 'Outfit' }}>
              No {filter === 'all' ? '' : filter === 'local' ? 'Local ' : 'Virtual '}Tournaments yet
            </h3>
            <p className="text-sm text-[#6B6E66] mb-4">
              {isAdmin
                ? 'Create a tournament to start competing!'
                : 'Create a Virtual Tournament and invite friends to compete remotely!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const href = item.kind === 'local' ? `/leaderboard/${item.id}` : `/tours/${item.id}`;
            return (
              <Link to={href} key={`${item.kind}:${item.id}`} className="block"
                data-testid={`tournament-card-${item.kind}-${item.id}`}>
                <Card className="border-[#E2E3DD] shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          <TypeBadge type={item.kind} />
                          <h3 className="text-base sm:text-lg font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>
                            {item.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={item.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-[10px]'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 text-[10px]'}>
                            {item.status}
                          </Badge>
                          {item.scoring_format && (
                            <Badge variant="outline" className="capitalize text-[10px]">{item.scoring_format}</Badge>
                          )}
                          {item.visibility === 'public' ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px]">
                              <Globe className="h-3 w-3 mr-0.5" />Public
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-[10px]">
                              <Lock className="h-3 w-3 mr-0.5" />Private
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B6E66] mt-2">
                          {item.course_name && (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.course_name}</span>
                          )}
                          {item.start_date && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{item.start_date}</span>
                          )}
                          <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{item.num_rounds} round{item.num_rounds > 1 ? 's' : ''}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{item.participants_count} players</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.visibility === 'public' || item.raw.invite_code ? (
                          <Button size="sm" variant="outline" className="border-[#E2E3DD]"
                            onClick={e => { e.preventDefault(); e.stopPropagation();
                              item.kind === 'local' ? shareLocal(item.raw) : shareVirtual(item.raw); }}>
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <ChevronRight className="h-5 w-5 text-[#6B6E66]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create type picker (admin only) */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>New Tournament</DialogTitle>
            <DialogDescription>Pick the format</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2">
            <button
              onClick={() => { setShowPicker(false); navigate('/tournament/new/edit'); }}
              className="flex items-start gap-3 p-4 rounded-xl border-2 border-[#E2E3DD] hover:border-[#1B3C35] hover:bg-[#1B3C35]/5 text-left transition-colors"
              data-testid="picker-local">
              <div className="w-10 h-10 rounded-full bg-[#1B3C35] text-white flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#1B3C35]">Local Tournament</p>
                <p className="text-xs text-[#6B6E66] mt-0.5">Everyone plays the same course on the same day. Admin keeps live scores.</p>
              </div>
            </button>
            <button
              onClick={() => { setShowPicker(false); setShowCreateVirtual(true); }}
              className="flex items-start gap-3 p-4 rounded-xl border-2 border-[#E2E3DD] hover:border-[#C96A52] hover:bg-[#C96A52]/5 text-left transition-colors"
              data-testid="picker-virtual">
              <div className="w-10 h-10 rounded-full bg-[#C96A52] text-white flex items-center justify-center shrink-0">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#1B3C35]">Virtual Tournament</p>
                <p className="text-xs text-[#6B6E66] mt-0.5">Each player plays their own course. Scores accumulate over N rounds.</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Virtual create dialog */}
      <Dialog open={showCreateVirtual} onOpenChange={setShowCreateVirtual}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Create Virtual Tournament</DialogTitle>
            <DialogDescription>Compete remotely — everyone plays their own local course.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[#1B3C35]">Tournament Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 border-[#E2E3DD]" placeholder="Summer Remote Challenge"
                data-testid="virtual-name-input" />
            </div>
            <div>
              <Label className="text-[#1B3C35]">Number of Rounds</Label>
              <Select value={numRounds} onValueChange={setNumRounds}>
                <SelectTrigger className="mt-1 border-[#E2E3DD]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 5, 7, 10, 15, 20].map(n => (<SelectItem key={n} value={String(n)}>{n} rounds</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#1B3C35]">Scoring</Label>
              <Select value={scoringFormat} onValueChange={setScoringFormat}>
                <SelectTrigger className="mt-1 border-[#E2E3DD]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stroke">Stroke Play (to par)</SelectItem>
                  <SelectItem value="stableford">Stableford (points)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#1B3C35]">Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="mt-1 border-[#E2E3DD]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Private - Invite only</span>
                  </SelectItem>
                  <SelectItem value="public">
                    <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Public - Anyone can see</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateVirtual(false)}>Cancel</Button>
            <Button onClick={createVirtual} disabled={creating} className="bg-[#C96A52] hover:bg-[#C96A52]/90"
              data-testid="create-virtual-submit">
              {creating ? 'Creating...' : 'Create Virtual Tournament'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
