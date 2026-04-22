// Random Scorer: admin shuffles a cycle so each player scores a different player.
// Players see who they must score.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Shuffle, ArrowRight, Users, Share2 } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';

export default function ScorerAssignments() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tournament, setTournament] = useState(null);
  const [data, setData] = useState({ assignments: [], my_target: null });
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, a] = await Promise.all([
        axios.get(`${API}/tournaments/${tournamentId}`),
        axios.get(`${API}/tournaments/${tournamentId}/scorer-assignments`)
      ]);
      setTournament(t.data);
      setData(a.data || { assignments: [], my_target: null });
    } catch {
      toast.error('Failed to load assignments');
    } finally { setLoading(false); }
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  const shuffle = async () => {
    if (!window.confirm('Re-shuffle all scorer assignments?')) return;
    setShuffling(true);
    try {
      const res = await axios.post(`${API}/tournaments/${tournamentId}/scorer-assignments/shuffle`);
      toast.success(`Shuffled ${res.data.count} pairings`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setShuffling(false); }
  };

  const shareTournament = () => {
    const url = tournament?.invite_code
      ? `${window.location.origin}/tournaments/join/${tournament.invite_code}`
      : `${window.location.origin}/leaderboard/${tournamentId}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!'));
  };

  const goScore = () => {
    if (!data.my_target) return;
    navigate(`/keeper/${tournamentId}?target=${data.my_target.user_id}`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-[#1B3C35]">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-3xl mx-auto fade-in" data-testid="scorer-assignments-page">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="sa-back-btn">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#C96A52]">Random Scorer</p>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>
            {tournament?.name || 'Scorer Assignments'}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={shareTournament} data-testid="share-sa-btn">
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {/* My assignment */}
      {data.my_target && (
        <Card className="border-[#C96A52] bg-[#C96A52]/5 shadow-none mb-5" data-testid="my-target-card">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#C96A52] mb-2">
              You're scoring
            </p>
            <div className="flex items-center gap-3">
              <PlayerAvatar user={data.my_target} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>
                  {data.my_target.name}
                </p>
                <p className="text-xs text-[#6B6E66]">Enter their strokes per hole</p>
              </div>
              <Button onClick={goScore} className="bg-[#1B3C35] hover:bg-[#1B3C35]/90"
                data-testid="go-score-target-btn">
                Score
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <div className="mb-5 flex gap-2">
          <Button onClick={shuffle} disabled={shuffling}
            className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" data-testid="shuffle-sa-btn">
            <Shuffle className="h-4 w-4 mr-1" />
            {shuffling ? 'Shuffling...' : data.assignments.length ? 'Re-shuffle Pairings' : 'Shuffle Assignments'}
          </Button>
        </div>
      )}

      {data.assignments.length === 0 ? (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-[#D6D7D2] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#1B3C35] mb-2" style={{ fontFamily: 'Outfit' }}>
              No assignments yet
            </h3>
            <p className="text-sm text-[#6B6E66]">
              {isAdmin
                ? 'Add all players first, then shuffle to create cross-scoring pairings.'
                : 'Waiting for the admin to shuffle pairings.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#6B6E66] mb-2">
            Pairings ({data.assignments.length})
          </p>
          {data.assignments.map((a, i) => (
            <Card key={i} className="border-[#E2E3DD] shadow-none" data-testid={`pairing-${i}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <PlayerAvatar user={a.scorer} size={28} />
                  <span className="text-sm font-medium text-[#1B3C35] truncate">{a.scorer.name}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-[#C96A52] shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-medium text-[#1B3C35] truncate">{a.target.name}</span>
                  <PlayerAvatar user={a.target} size={28} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
