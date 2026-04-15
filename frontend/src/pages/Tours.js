import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Globe, Users, ChevronRight, Hash, Share2 } from 'lucide-react';

export default function Tours() {
  const { user } = useAuth();
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [numRounds, setNumRounds] = useState('5');
  const [scoringFormat, setScoringFormat] = useState('stroke');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    axios.get(`${API}/tours`).then(r => setTours(r.data))
      .catch(() => toast.error('Failed to load tours'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      await axios.post(`${API}/tours`, {
        name: name.trim(), num_rounds: parseInt(numRounds), scoring_format: scoringFormat
      });
      toast.success('Tour created!');
      setShowCreate(false);
      setName('');
      const r = await axios.get(`${API}/tours`);
      setTours(r.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const shareTour = (tour) => {
    const url = `${window.location.origin}/tours/join/${tour.invite_code}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!'));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-[#1B3C35]">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto fade-in" data-testid="tours-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">Remote Competition</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Virtual Tours
          </h1>
          <p className="text-sm text-[#6B6E66] mt-1">Compete with friends remotely - everyone plays their local course</p>
        </div>
        {user && (
          <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={() => setShowCreate(true)}
            data-testid="create-tour-btn">
            <Plus className="h-4 w-4 mr-1" />New Tour
          </Button>
        )}
      </div>

      {tours.length === 0 ? (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="py-16 text-center">
            <Globe className="h-12 w-12 text-[#D6D7D2] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#1B3C35] mb-2" style={{ fontFamily: 'Outfit' }}>No Tours Yet</h3>
            <p className="text-sm text-[#6B6E66] mb-4">Create a Virtual Tour and invite friends to compete remotely!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tours.map(tour => {
            const leader = tour.participants?.reduce((best, p) =>
              tour.scoring_format === 'stableford'
                ? ((p.total_stableford || 0) > (best?.total_stableford || 0) ? p : best)
                : (best === null || (p.rounds_played > 0 && p.total_to_par < (best.total_to_par ?? 999)) ? p : best)
            , null);
            return (
              <Link to={`/tours/${tour.tour_id}`} key={tour.tour_id} className="block"
                data-testid={`tour-card-${tour.tour_id}`}>
                <Card className="border-[#E2E3DD] shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-lg font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>{tour.name}</h3>
                          <Badge className={tour.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'}>
                            {tour.status}
                          </Badge>
                          <Badge variant="outline" className="capitalize text-[10px]">{tour.scoring_format}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-[#6B6E66]">
                          <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{tour.num_rounds} rounds</span>
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{tour.participants?.length || 0} players</span>
                          {leader && leader.rounds_played > 0 && (
                            <span>Leader: {leader.player_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="border-[#E2E3DD]"
                          onClick={e => { e.preventDefault(); e.stopPropagation(); shareTour(tour); }}
                          data-testid={`share-tour-${tour.tour_id}`}>
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Create Virtual Tour</DialogTitle>
            <DialogDescription>Compete remotely - everyone plays their own local course!</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[#1B3C35]">Tour Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 border-[#E2E3DD]" placeholder="Summer Remote Challenge"
                data-testid="tour-name-input" />
            </div>
            <div>
              <Label className="text-[#1B3C35]">Number of Rounds</Label>
              <Select value={numRounds} onValueChange={setNumRounds}>
                <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="tour-rounds-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 7, 10, 15, 20].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} rounds</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#1B3C35]">Scoring</Label>
              <Select value={scoringFormat} onValueChange={setScoringFormat}>
                <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="tour-scoring-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stroke">Stroke Play (to par)</SelectItem>
                  <SelectItem value="stableford">Stableford (points)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-[#1B3C35] hover:bg-[#1B3C35]/90"
              data-testid="create-tour-submit">{creating ? 'Creating...' : 'Create Tour'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
