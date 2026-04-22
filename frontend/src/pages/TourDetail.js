import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Globe, Users, Share2, Hash, Flag, MapPin, Check, Pencil, Settings, Copy, UserPlus, Search, X, Sparkles, User2 } from 'lucide-react';

function formatToPar(s) { return s === 0 ? 'E' : s > 0 ? `+${s}` : `${s}`; }
function scoreClr(s) { return s < 0 ? 'text-[#C96A52] font-bold' : s > 0 ? 'text-[#1D2D44]' : 'text-[#4A5D23] font-bold'; }

export default function TourDetail() {
  const { tourId, inviteCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myRounds, setMyRounds] = useState([]);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState([]);
  const [editingCourseFor, setEditingCourseFor] = useState(null); // participant being edited
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);
  // Invite panel
  const [invites, setInvites] = useState([]);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteForm, setInviteForm] = useState({ player_name: '', course_id: 'none', target_user_id: null });
  const [creatingInvite, setCreatingInvite] = useState(false);
  // Registered user search for invites
  const [userSearchQ, setUserSearchQ] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  // Inline Add Course (AI search)
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [acQuery, setAcQuery] = useState('');
  const [acSearching, setAcSearching] = useState(false);
  const [acResult, setAcResult] = useState(null);
  const [acSaving, setAcSaving] = useState(false);
  const [acCallback, setAcCallback] = useState(null); // 'participant' | 'invite'

  const fetchTour = async () => {
    try {
      let res;
      if (inviteCode) {
        res = await axios.get(`${API}/tours/invite/${inviteCode}`);
        // Personal invite: has invite_id + nested tour meta
        if (res.data?.invite_id && user) {
          try {
            const acc = await axios.post(`${API}/tours/invite/${inviteCode}/accept`);
            toast.success('Invitation accepted!');
            navigate(`/tours/${acc.data.tour_id}`, { replace: true });
            return;
          } catch (e) {
            toast.error(e.response?.data?.detail || 'Could not accept invite');
          }
        }
        // Personal invite and NOT logged in → redirect to login with callback
        if (res.data?.invite_id && !user) {
          navigate(`/login?next=/tours/join/${inviteCode}`, { replace: true });
          return;
        }
        // Regular tour invite code → open full tour
        if (res.data?.tour_id) {
          navigate(`/tours/${res.data.tour_id}`, { replace: true });
          return;
        }
      } else {
        res = await axios.get(`${API}/tours/${tourId}`);
      }
      setTour(res.data);
    } catch {
      toast.error('Tournament not found');
      navigate('/tours');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRounds = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API}/rounds/my`);
      setMyRounds(res.data);
    } catch {}
  };

  useEffect(() => { fetchTour(); }, [tourId, inviteCode]);
  useEffect(() => { fetchMyRounds(); }, [user]);
  useEffect(() => {
    axios.get(`${API}/courses`).then(r => setCourses(r.data || [])).catch(() => {});
  }, []);

  const loadInvites = async () => {
    if (!tour?.tour_id) return;
    try {
      const res = await axios.get(`${API}/tours/${tour.tour_id}/invites`);
      setInvites(res.data || []);
    } catch {}
  };
  useEffect(() => {
    if (tour && user && (tour.created_by === user.user_id || user.role === 'admin')) {
      loadInvites();
    }
  }, [tour, user]); // eslint-disable-line

  const createInvite = async () => {
    const { player_name, course_id, target_user_id } = inviteForm;
    setCreatingInvite(true);
    try {
      const c = courses.find(x => x.course_id === course_id);
      await axios.post(`${API}/tours/${tour.tour_id}/invites`, {
        player_name, target_user_id,
        course_id: course_id === 'none' ? null : course_id,
        course_name: c?.course_name || ''
      });
      toast.success('Invite created');
      setInviteForm({ player_name: '', course_id: 'none', target_user_id: null });
      setUserSearchQ('');
      loadInvites();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setCreatingInvite(false); }
  };

  // Registered user search (debounced in the UI — keep it simple)
  const searchRegisteredUsers = async (q) => {
    setUserSearchQ(q);
    if (q.trim().length < 2) { setUserSearchResults([]); return; }
    try {
      const res = await axios.get(`${API}/users/search`, { params: { q: q.trim() } });
      // Exclude users already participating
      const participantIds = new Set((tour?.participants || []).map(p => p.user_id));
      setUserSearchResults((res.data || []).filter(u => !participantIds.has(u.user_id)));
    } catch { setUserSearchResults([]); }
  };
  const pickRegisteredUser = (u) => {
    setInviteForm(prev => ({ ...prev, player_name: u.name, target_user_id: u.user_id }));
    setUserSearchQ(u.name);
    setUserSearchOpen(false);
  };
  const clearPickedUser = () => {
    setInviteForm(prev => ({ ...prev, player_name: '', target_user_id: null }));
    setUserSearchQ('');
  };

  const deleteInvite = async (inv) => {
    if (!window.confirm(`Delete invite${inv.player_name ? ' for ' + inv.player_name : ''}?`)) return;
    try {
      await axios.delete(`${API}/tours/${tour.tour_id}/invites/${inv.invite_id}`);
      toast.success('Invite deleted');
      loadInvites();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const updateInviteCourse = async (inv, newCourseId) => {
    try {
      const c = courses.find(x => x.course_id === newCourseId);
      await axios.put(`${API}/tours/${tour.tour_id}/invites/${inv.invite_id}`, {
        course_id: newCourseId === 'none' ? null : newCourseId,
        course_name: c?.course_name || ''
      });
      loadInvites();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const copyInviteLink = (inv) => {
    const url = `${window.location.origin}/tours/join/${inv.code}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
  };

  // Add Course inline (AI search + save)
  const openAddCourse = (callback) => {
    setAcCallback(callback);
    setAcQuery('');
    setAcResult(null);
    setShowAddCourse(true);
  };
  const runAcSearch = async () => {
    if (!acQuery.trim()) return;
    setAcSearching(true); setAcResult(null);
    try {
      const res = await axios.post(`${API}/courses/search`, { query: acQuery.trim() });
      if (res.data.status === 'found') setAcResult(res.data.data);
      else toast.error(res.data.message || 'Not found');
    } catch (err) { toast.error(err.response?.data?.detail || 'Search failed'); }
    finally { setAcSearching(false); }
  };
  const saveAcResult = async () => {
    if (!acResult) return;
    setAcSaving(true);
    try {
      const res = await axios.post(`${API}/courses`, acResult);
      toast.success('Course added!');
      const c = res.data;
      // Refresh courses list
      const listRes = await axios.get(`${API}/courses`);
      setCourses(listRes.data || []);
      // Apply to active target
      if (acCallback === 'participant' && editingCourseFor) {
        setSelectedCourseId(c.course_id);
      } else if (acCallback === 'invite') {
        setInviteForm(prev => ({ ...prev, course_id: c.course_id }));
      }
      setShowAddCourse(false);
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setAcSaving(false); }
  };

  const openCourseEditor = (participant) => {
    setEditingCourseFor(participant);
    setSelectedCourseId(participant.course_id || 'none');
  };

  const saveParticipantCourse = async () => {
    if (!editingCourseFor) return;
    setSavingCourse(true);
    try {
      const courseId = selectedCourseId === 'none' ? null : selectedCourseId;
      const c = courses.find(x => x.course_id === courseId);
      await axios.put(
        `${API}/tours/${tour.tour_id}/participants/${editingCourseFor.user_id}/course`,
        { course_id: courseId, course_name: c?.course_name || '' }
      );
      toast.success('Course updated');
      setEditingCourseFor(null);
      fetchTour();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setSavingCourse(false); }
  };

  const handleJoin = async () => {
    try {
      await axios.post(`${API}/tours/${tour.tour_id}/join`);
      toast.success('Joined the tour!');
      fetchTour();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to join');
    }
  };

  const shareTour = () => {
    const url = `${window.location.origin}/tours/join/${tour.invite_code}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied! Share with friends'));
  };

  const submitRound = async (roundId) => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/tours/${tour.tour_id}/submit-round`, { round_id: roundId });
      toast.success(`Round ${res.data.round_number} submitted!`);
      setShowSubmit(false);
      fetchTour();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !tour) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-[#1B3C35]">Loading...</div>
    </div>;
  }

  const isParticipant = user && tour.participants?.some(p => p.user_id === user.user_id);
  const isCreator = user && tour.created_by === user.user_id;
  const isAdmin = user && user.role === 'admin';
  const canEditTour = isCreator || isAdmin;
  const myTourRounds = tour.participants?.find(p => p.user_id === user?.user_id);
  const roundsPlayed = myTourRounds?.rounds_played || 0;
  const canSubmit = isParticipant && roundsPlayed < tour.num_rounds;
  const isStableford = tour.scoring_format === 'stableford';
  const participants = tour.participants || [];

  // Filter rounds that haven't been submitted to any tour yet
  const submittedRoundIds = new Set((myTourRounds?.rounds || []).map(r => r.round_id));
  const availableRounds = myRounds.filter(r => r.status === 'completed' && !submittedRoundIds.has(r.round_id));

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto fade-in" data-testid="tour-detail">
      <Button variant="ghost" size="sm" className="mb-4 text-[#6B6E66]" onClick={() => navigate('/tours')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Tournaments
      </Button>

      {/* Header */}
      <Card className="border-[#E2E3DD] shadow-none mb-6">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-bold text-[#C96A52]">Virtual Tournament</p>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                {tour.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-[#6B6E66]">
                <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{tour.num_rounds} rounds</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{participants.length} players</span>
                <Badge variant="outline" className="capitalize">{tour.scoring_format}</Badge>
                <Badge className={tour.status === 'active'
                  ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'}>
                  {tour.status}
                </Badge>
              </div>
              {isParticipant && (
                <p className="text-xs text-[#6B6E66] mt-2">Your progress: {roundsPlayed}/{tour.num_rounds} rounds</p>
              )}
            </div>
            <div className="flex gap-2">
              {tour.status === 'active' && !isParticipant && user && (
                <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={handleJoin} data-testid="join-tour-btn">
                  Join Tournament
                </Button>
              )}
              {canEditTour && (
                <Button variant="outline" className="border-[#E2E3DD]"
                  onClick={() => navigate(`/tour/${tour.tour_id}/edit`)}
                  data-testid="edit-tour-btn">
                  <Settings className="h-4 w-4 mr-1" />Edit
                </Button>
              )}
              <Button variant="outline" className="border-[#E2E3DD]" onClick={shareTour} data-testid="share-tour-btn">
                <Share2 className="h-4 w-4 mr-1" />Invite
              </Button>
            </div>
          </div>
          {tour.description && (
            <p className="text-sm text-[#6B6E66] mt-3 whitespace-pre-wrap">{tour.description}</p>
          )}
          {tour.suggested_course_name && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-[#6B6E66]">
              <Flag className="h-3 w-3 text-[#C96A52]" />
              <span>Default course: <span className="font-semibold text-[#1B3C35]">{tour.suggested_course_name}</span></span>
            </div>
          )}
          {/* Action buttons for participants */}
          {canSubmit && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-[#E2E3DD]">
              <Link to="/play" data-testid="play-for-tour-btn">
                <Button className="bg-[#C96A52] hover:bg-[#C96A52]/90">
                  <Flag className="h-4 w-4 mr-1" />Play a Round
                </Button>
              </Link>
              <Button variant="outline" className="border-[#E2E3DD] text-[#1B3C35]"
                onClick={() => { fetchMyRounds(); setShowSubmit(true); }} data-testid="submit-round-btn">
                <Check className="h-4 w-4 mr-1" />Submit Round
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="border-[#E2E3DD] shadow-none overflow-hidden">
        <CardHeader className="py-3 bg-[#1B3C35] rounded-t-xl">
          <CardTitle className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Tournament Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {participants.length === 0 ? (
            <div className="py-12 text-center text-[#6B6E66] text-sm">No participants yet.</div>
          ) : (
            <div>
              {/* Header */}
              <div className="grid grid-cols-[2rem_1fr_repeat(var(--cols),3rem)_4rem] sm:grid-cols-[2.5rem_1fr_repeat(var(--cols),4rem)_5rem] items-center px-3 py-2 bg-[#E8E9E3]/50 border-b border-[#E2E3DD] text-[10px] font-bold text-[#1B3C35] uppercase"
                style={{ '--cols': tour.num_rounds }}>
                <span className="text-center">#</span>
                <span>Player</span>
                {Array.from({ length: tour.num_rounds }, (_, i) => (
                  <span key={i} className="text-center">R{i + 1}</span>
                ))}
                <span className="text-center">Total</span>
              </div>
              {/* Rows */}
              {participants.map((p, i) => {
                const rounds = p.rounds || [];
                const isMe = user && p.user_id === user.user_id;
                const canEditCourse = isMe || canEditTour;
                return (
                  <div key={p.user_id}
                    className={`grid grid-cols-[2rem_1fr_repeat(var(--cols),3rem)_4rem] sm:grid-cols-[2.5rem_1fr_repeat(var(--cols),4rem)_5rem] items-center px-3 py-2.5 border-b border-[#E2E3DD] last:border-0 ${i === 0 && p.rounds_played > 0 ? 'bg-amber-50/30' : ''}`}
                    style={{ '--cols': tour.num_rounds }}
                    data-testid={`tour-player-${i}`}>
                    <span className="text-center text-sm font-bold text-[#1B3C35] tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-[#1B3C35] truncate block">{p.player_name}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Flag className={`h-3 w-3 shrink-0 ${p.course_name ? 'text-[#C96A52]' : 'text-[#D6D7D2]'}`} />
                        <span className="text-[10px] text-[#6B6E66] truncate">
                          {p.course_name || <span className="italic">no course set</span>}
                        </span>
                        {canEditCourse && (
                          <button onClick={() => openCourseEditor(p)}
                            className="text-[#C96A52] hover:text-[#1B3C35] shrink-0"
                            data-testid={`edit-course-${p.user_id}`}>
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {Array.from({ length: tour.num_rounds }, (_, ri) => {
                      const round = rounds.find(r => r.round_number === ri + 1);
                      return (
                        <span key={ri} className={`text-center text-xs tabular-nums ${round
                          ? (isStableford ? 'text-[#1B3C35] font-bold' : scoreClr(round.total_to_par))
                          : 'text-[#D6D7D2]'}`}>
                          {round
                            ? (isStableford ? round.stableford_points : formatToPar(round.total_to_par))
                            : '-'}
                        </span>
                      );
                    })}
                    <span className={`text-center text-sm font-bold tabular-nums ${
                      p.rounds_played > 0
                        ? (isStableford ? 'text-[#1B3C35]' : scoreClr(p.total_to_par))
                        : 'text-[#D6D7D2]'}`}>
                      {p.rounds_played > 0
                        ? (isStableford ? p.total_stableford : formatToPar(p.total_to_par))
                        : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Players Panel — creator & admin only */}
      {canEditTour && (
        <Card className="border-[#E2E3DD] shadow-none mt-5" data-testid="invite-panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
                <UserPlus className="h-4 w-4 text-[#C96A52]" />
                Invite Players ({invites.filter(i => i.status === 'pending').length} pending)
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowInvitePanel(v => !v)}
                data-testid="toggle-invite-panel">
                {showInvitePanel ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-xs text-[#6B6E66] -mt-1">
              Create personal links with the course pre-assigned. Share by WhatsApp/email — recipient just clicks to join.
            </p>
          </CardHeader>
          {showInvitePanel && (
            <CardContent className="space-y-3">
              {/* New invite form */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 p-3 rounded-lg bg-[#E8E9E3]/40 border border-dashed border-[#D6D7D2]">
                {/* Combobox: search registered user OR type custom name */}
                <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <User2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B6E66] pointer-events-none" />
                      <Input
                        placeholder="Search registered or type name"
                        value={userSearchQ}
                        onFocus={() => setUserSearchOpen(true)}
                        onChange={e => {
                          searchRegisteredUsers(e.target.value);
                          setInviteForm(prev => ({ ...prev, player_name: e.target.value, target_user_id: null }));
                          setUserSearchOpen(true);
                        }}
                        className="h-10 pl-8 border-[#E2E3DD] bg-white"
                        data-testid="invite-user-search" />
                      {inviteForm.target_user_id && (
                        <button type="button" onClick={clearPickedUser}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B6E66] hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}>
                    {userSearchResults.length > 0 ? (
                      <ul className="max-h-60 overflow-auto py-1">
                        {userSearchResults.map(u => (
                          <li key={u.user_id}>
                            <button type="button"
                              onClick={() => pickRegisteredUser(u)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#E8E9E3]/60 text-left"
                              data-testid={`pick-user-${u.user_id}`}>
                              {u.picture
                                ? <img src={u.picture} alt="" className="w-6 h-6 rounded-full object-cover" />
                                : <div className="w-6 h-6 rounded-full bg-[#1B3C35] text-white text-xs flex items-center justify-center">
                                    {(u.name || '?')[0].toUpperCase()}
                                  </div>}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[#1B3C35] truncate">{u.name}</p>
                                <p className="text-[10px] text-[#6B6E66] truncate">{u.email}</p>
                              </div>
                              <Check className="h-3 w-3 text-[#4A5D23] opacity-0 group-data-[state=checked]:opacity-100" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-3 py-3 text-xs text-[#6B6E66]">
                        {userSearchQ.length < 2
                          ? 'Type 2+ characters to search registered players…'
                          : 'No matches — you can still send with this name as a plain invite.'}
                      </p>
                    )}
                  </PopoverContent>
                </Popover>

                <div className="flex flex-col gap-1">
                  <Select value={inviteForm.course_id || 'none'}
                    onValueChange={v => setInviteForm({ ...inviteForm, course_id: v })}>
                    <SelectTrigger className="h-10 border-[#E2E3DD] bg-white" data-testid="invite-course-select">
                      <SelectValue placeholder="Course (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Let them pick —</SelectItem>
                      {courses.map(c => (
                        <SelectItem key={c.course_id} value={c.course_id}>
                          {c.course_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={() => openAddCourse('invite')}
                    className="text-[10px] font-bold text-[#C96A52] hover:text-[#1B3C35] flex items-center gap-1"
                    data-testid="invite-add-course-btn">
                    <Sparkles className="h-3 w-3" /> Add new course
                  </button>
                </div>
                <Button onClick={createInvite} disabled={creatingInvite}
                  className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-10"
                  data-testid="create-invite-btn">
                  <UserPlus className="h-4 w-4 mr-1" />
                  {creatingInvite ? '...' : 'Create'}
                </Button>
              </div>
              {inviteForm.target_user_id && (
                <p className="text-[11px] text-[#4A5D23] -mt-2 pl-1 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Linked to registered player — they'll skip signup when accepting.
                </p>
              )}

              {/* Existing invites */}
              {invites.length === 0 ? (
                <p className="text-xs text-[#6B6E66] italic text-center py-2">No invites yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {invites.map(inv => (
                    <div key={inv.invite_id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${inv.status === 'accepted' ? 'bg-[#4A5D23]/5 border-[#4A5D23]/20' : 'border-[#E2E3DD]'}`}
                      data-testid={`invite-row-${inv.invite_id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {inv.status === 'accepted'
                            ? <Check className="h-3 w-3 text-[#4A5D23] shrink-0" />
                            : <Hash className="h-3 w-3 text-[#6B6E66] shrink-0" />}
                          <span className="text-sm font-semibold text-[#1B3C35] truncate">
                            {inv.player_name || <span className="italic text-[#6B6E66]">Unnamed</span>}
                          </span>
                          <code className="text-[10px] text-[#C96A52] font-mono">{inv.code}</code>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Flag className={`h-3 w-3 shrink-0 ${inv.course_name ? 'text-[#C96A52]' : 'text-[#D6D7D2]'}`} />
                          {inv.status === 'accepted' ? (
                            <span className="text-[10px] text-[#6B6E66] truncate">
                              {inv.course_name || 'no course'}
                            </span>
                          ) : (
                            <Select value={inv.course_id || 'none'}
                              onValueChange={v => updateInviteCourse(inv, v)}>
                              <SelectTrigger className="h-7 border-0 shadow-none bg-transparent text-[10px] text-[#6B6E66] pl-0"
                                data-testid={`invite-course-${inv.invite_id}`}>
                                <SelectValue placeholder="no course" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Let them pick —</SelectItem>
                                {courses.map(c => (
                                  <SelectItem key={c.course_id} value={c.course_id}>
                                    {c.course_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      {inv.status !== 'accepted' && (
                        <>
                          <button onClick={() => copyInviteLink(inv)}
                            className="text-[#1B3C35] hover:text-[#C96A52] shrink-0 p-1"
                            title="Copy invite link" data-testid={`copy-invite-${inv.invite_id}`}>
                            <Copy className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteInvite(inv)}
                            className="text-[#6B6E66] hover:text-red-600 shrink-0 p-1"
                            title="Delete invite" data-testid={`delete-invite-${inv.invite_id}`}>
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Submit Round Dialog */}
      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Submit a Round</DialogTitle>
            <DialogDescription>Select a completed round to count toward this Tour.</DialogDescription>
          </DialogHeader>
          {availableRounds.length === 0 ? (
            <div className="py-6 text-center text-[#6B6E66]">
              <p className="text-sm mb-3">No completed rounds available to submit.</p>
              <Link to="/play">
                <Button className="bg-[#C96A52] hover:bg-[#C96A52]/90">
                  <Flag className="h-4 w-4 mr-1" />Play a Round First
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {availableRounds.map(r => (
                <div key={r.round_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#E2E3DD] hover:bg-[#E8E9E3]/30 transition-colors">
                  <div>
                    <p className="font-medium text-[#1B3C35] text-sm">{r.course_name}</p>
                    <p className="text-xs text-[#6B6E66]">
                      {r.total_strokes} strokes &middot; {r.created_at?.split('T')[0]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold tabular-nums ${scoreClr(r.total_to_par)}`}>
                      {formatToPar(r.total_to_par)}
                    </span>
                    <Button size="sm" className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" disabled={submitting}
                      onClick={() => submitRound(r.round_id)} data-testid={`submit-round-${r.round_id}`}>
                      Submit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit participant course dialog */}
      <Dialog open={!!editingCourseFor} onOpenChange={v => !v && setEditingCourseFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>
              {editingCourseFor?.user_id === user?.user_id ? 'Pick Your Course' : `Assign Course · ${editingCourseFor?.player_name}`}
            </DialogTitle>
            <DialogDescription>
              Choose the course this player will play for their rounds. Leave blank to let them decide later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedCourseId || 'none'} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="border-[#E2E3DD] h-12" data-testid="participant-course-select">
                <SelectValue placeholder="Pick a course..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No course —</SelectItem>
                {courses.map(c => (
                  <SelectItem key={c.course_id} value={c.course_id}>
                    {c.course_name} {c.num_holes ? `· ${c.num_holes} holes` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button type="button"
              onClick={() => openAddCourse('participant')}
              className="mt-2 text-xs font-bold text-[#C96A52] hover:text-[#1B3C35] flex items-center gap-1"
              data-testid="add-new-course-btn">
              <Sparkles className="h-3.5 w-3.5" /> My course isn't listed — add it
            </button>
            {courses.length === 0 && (
              <p className="text-xs text-[#6B6E66] mt-2">
                No courses in the database yet. Click above to add one.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCourseFor(null)}>Cancel</Button>
            <Button onClick={saveParticipantCourse} disabled={savingCourse}
              className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" data-testid="save-participant-course-btn">
              {savingCourse ? 'Saving...' : 'Save Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Course (AI search) dialog — used from both participant editor and invite form */}
      <Dialog open={showAddCourse} onOpenChange={setShowAddCourse}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit' }}>Add Course</DialogTitle>
            <DialogDescription>
              Type the name of your golf course and we'll look it up for you. Scorecard data is fetched from the web.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input placeholder="e.g. Pebble Beach Golf Links"
                value={acQuery} onChange={e => setAcQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAcSearch()}
                className="h-11 border-[#E2E3DD]" data-testid="ac-query-input" />
              <Button onClick={runAcSearch} disabled={acSearching || !acQuery.trim()}
                className="bg-[#C96A52] hover:bg-[#C96A52]/90 h-11" data-testid="ac-search-btn">
                <Search className="h-4 w-4 mr-1" />
                {acSearching ? '...' : 'Search'}
              </Button>
            </div>

            {acSearching && (
              <p className="text-xs text-[#6B6E66] text-center py-4">Searching the web for scorecard…</p>
            )}

            {acResult && (
              <div className="p-3 rounded-lg border border-[#E2E3DD] bg-[#E8E9E3]/30 space-y-2"
                data-testid="ac-result">
                <div>
                  <p className="font-bold text-[#1B3C35]">{acResult.course_name}</p>
                  <p className="text-xs text-[#6B6E66]">
                    {acResult.num_holes || acResult.tees?.[0]?.holes?.length || 18} holes
                    {acResult.tees?.length ? ` · ${acResult.tees.length} tees` : ''}
                  </p>
                </div>
                {acResult.tees && acResult.tees[0]?.holes && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {acResult.tees[0].holes.slice(0, 18).map((h, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#E2E3DD]">
                        {i + 1}: P{h.par}
                      </span>
                    ))}
                  </div>
                )}
                <Button onClick={saveAcResult} disabled={acSaving}
                  className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90" data-testid="ac-save-btn">
                  {acSaving ? 'Saving...' : 'Add to Courses'}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCourse(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
