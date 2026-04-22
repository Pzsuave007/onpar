import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Globe, Users, Share2, Hash, Flag, MapPin, Check, Pencil, Settings } from 'lucide-react';

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

  const fetchTour = async () => {
    try {
      let res;
      if (inviteCode) {
        res = await axios.get(`${API}/tours/invite/${inviteCode}`);
        // Redirect to full tour page
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
            {courses.length === 0 && (
              <p className="text-xs text-[#6B6E66] mt-2">
                No courses in the database yet. Admin can add courses in the admin panel.
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
    </div>
  );
}
