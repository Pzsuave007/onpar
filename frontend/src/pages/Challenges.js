import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
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
import { Plus, Target, Trophy, MapPin, Users, ChevronRight, Lock, Globe, Copy } from 'lucide-react';

export default function Challenges() {
  const { user } = useAuth();
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState('private');

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/challenges`),
      axios.get(`${API}/courses`)
    ]).then(([chRes, cRes]) => {
      setChallenges(chRes.data);
      setCourses(cRes.data);
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, []);

  // Handle invite code
  useEffect(() => {
    if (!inviteCode) return;
    axios.get(`${API}/challenges/invite/${inviteCode}`).then(res => {
      const ch = res.data;
      if (user) {
        axios.post(`${API}/challenges/${ch.challenge_id}/join`).then(() => {
          toast.success('Joined challenge!');
        }).catch(() => {});
      }
      navigate(`/challenges/${ch.challenge_id}`, { replace: true });
    }).catch(() => {
      toast.error('Invalid invite code');
    });
  }, [inviteCode, user, navigate]);

  const toggleCourse = (courseId) => {
    setSelectedCourses(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedCourses.length === 0) {
      toast.error('Name and at least one course required');
      return;
    }
    setCreating(true);
    try {
      await axios.post(`${API}/challenges`, { name: name.trim(), course_ids: selectedCourses, visibility });
      toast.success('Challenge created!');
      setShowCreate(false);
      setName('');
      setSelectedCourses([]);
      setVisibility('private');
      const res = await axios.get(`${API}/challenges`);
      setChallenges(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading challenges...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto fade-in" data-testid="challenges-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">Games</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1B3C35] tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Birdie Challenge
          </h1>
          <p className="text-sm text-[#6B6E66] mt-1">Birdie every hole across multiple courses to win!</p>
        </div>
        {user && (
          <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={() => setShowCreate(true)}
            data-testid="create-challenge-btn">
            <Plus className="h-4 w-4 mr-1" />New Challenge
          </Button>
        )}
      </div>

      {challenges.length === 0 ? (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="py-16 text-center">
            <Target className="h-12 w-12 text-[#D6D7D2] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#1B3C35] mb-2" style={{ fontFamily: 'Outfit' }}>No Challenges Yet</h3>
            <p className="text-sm text-[#6B6E66] mb-4">Create a Birdie Challenge and compete with friends!</p>
            {user && (
              <Button className="bg-[#C96A52] hover:bg-[#C96A52]/90" onClick={() => setShowCreate(true)}>
                Create First Challenge
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {challenges.map(ch => {
            const myProgress = ch.participants?.find(p => p.user_id === user?.user_id);
            const leader = ch.participants?.reduce((best, p) => (p.completed_holes || 0) > (best?.completed_holes || 0) ? p : best, null);
            return (
              <Link to={`/challenges/${ch.challenge_id}`} key={ch.challenge_id}
                className="block" data-testid={`challenge-card-${ch.challenge_id}`}>
                <Card className="border-[#E2E3DD] shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-lg font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>{ch.name}</h3>
                          <Badge className={ch.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
                            : ch.winner_id ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'}>
                            {ch.winner_name ? `Won by ${ch.winner_name}` : ch.status}
                          </Badge>
                          {ch.visibility === 'public' ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px]">
                              <Globe className="h-3 w-3 mr-0.5" />Public
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-[10px]">
                              <Lock className="h-3 w-3 mr-0.5" />Private
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-[#6B6E66]">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {ch.courses_info?.map(c => c.course_name).join(', ')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3.5 w-3.5" />{ch.total_holes} holes
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />{ch.participants?.length || 0}
                          </span>
                        </div>
                        {/* Progress bar for leader */}
                        {leader && leader.completed_holes > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-[#6B6E66] mb-1">
                              <span>Leader: {leader.player_name}</span>
                              <span>{leader.completed_holes}/{ch.total_holes}</span>
                            </div>
                            <div className="h-2 bg-[#E8E9E3] rounded-full overflow-hidden">
                              <div className="h-full bg-[#C96A52] rounded-full transition-all"
                                style={{ width: `${Math.round((leader.completed_holes / ch.total_holes) * 100)}%` }} />
                            </div>
                          </div>
                        )}
                        {ch.visibility !== 'public' && ch.invite_code && (
                          <button className="text-xs text-[#6B6E66] mt-2 flex items-center gap-1 hover:text-[#1B3C35] transition-colors"
                            onClick={(e) => {
                              e.preventDefault(); e.stopPropagation();
                              const url = `${window.location.origin}/challenges/join/${ch.invite_code}`;
                              navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!'));
                            }}>
                            <Copy className="h-3 w-3" />Invite: {ch.invite_code}
                          </button>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#6B6E66] shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Challenge Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>New Birdie Challenge</DialogTitle>
            <DialogDescription>Select courses and challenge your friends to birdie every hole!</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[#1B3C35]">Challenge Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 border-[#E2E3DD]" placeholder="e.g. Summer Birdie Battle"
                data-testid="challenge-name-input" />
            </div>
            <div>
              <Label className="text-[#1B3C35] mb-2 block">Select Courses ({selectedCourses.length} selected)</Label>
              {courses.length === 0 ? (
                <p className="text-sm text-[#6B6E66]">No courses saved. Go to Admin → Courses to add courses first.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {courses.map(c => (
                    <div key={c.course_id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCourses.includes(c.course_id)
                          ? 'border-[#1B3C35] bg-[#1B3C35]/5'
                          : 'border-[#E2E3DD] hover:bg-[#E8E9E3]/30'
                      }`}
                      onClick={() => toggleCourse(c.course_id)}
                      data-testid={`course-select-${c.course_id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-[#1B3C35]">{c.course_name}</span>
                          <span className="text-xs text-[#6B6E66] ml-2">{c.num_holes} holes &middot; Par {c.total_par}</span>
                        </div>
                        {selectedCourses.includes(c.course_id) && (
                          <div className="w-5 h-5 rounded-full bg-[#1B3C35] flex items-center justify-center">
                            <span className="text-white text-xs">&#10003;</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedCourses.length > 0 && (
                <p className="text-xs text-[#6B6E66] mt-2">
                  Total: {courses.filter(c => selectedCourses.includes(c.course_id)).reduce((s, c) => s + c.num_holes, 0)} holes to birdie
                </p>
              )}
            </div>
            <div>
              <Label className="text-[#1B3C35]">Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="challenge-visibility">
                  <SelectValue />
                </SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-[#1B3C35] hover:bg-[#1B3C35]/90"
              data-testid="create-challenge-submit">
              {creating ? 'Creating...' : 'Create Challenge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
