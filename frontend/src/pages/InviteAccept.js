// Invite preview & accept page — shown when a user opens /tours/join/{code}.
// If the invite code belongs to a personal tour_invite, render a confirmation
// card (tournament, course, rounds, creator) with an explicit Accept button.
// If the code is the tour-wide invite_code, redirect straight to the tour.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth, API } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trophy, Flag, Calendar, User2, Check, ArrowRight, LogIn } from 'lucide-react';

export default function InviteAccept() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [creatorName, setCreatorName] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    axios.get(`${API}/tours/invite/${inviteCode}`).then(async (res) => {
      const data = res.data;
      // tour-wide invite code → direct to tour
      if (data?.tour_id && !data.invite_id) {
        navigate(`/tours/${data.tour_id}`, { replace: true });
        return;
      }
      if (data?.status === 'accepted') {
        toast('Este invite ya fue usado. Abriendo el torneo…');
        navigate(`/tours/${data.tour_id}`, { replace: true });
        return;
      }
      setInvite(data);
      // Fetch creator name (nice-to-have)
      if (data?.created_by) {
        try {
          const cr = await axios.get(`${API}/users/search`, { params: { q: '' } }).catch(() => null);
          if (cr?.data) {
            // Fallback: we don't have a direct get-user endpoint; pull from tour object
            const tRes = await axios.get(`${API}/tours/${data.tour_id}`).catch(() => null);
            if (tRes?.data) {
              const creator = (tRes.data.participants || []).find(p => p.user_id === data.created_by);
              if (creator) setCreatorName(creator.player_name);
            }
          }
        } catch {}
      }
    }).catch(() => {
      toast.error('Invitation not found or expired');
      navigate('/tours');
    }).finally(() => setLoading(false));
  }, [inviteCode, navigate]);

  const accept = async () => {
    if (!user) {
      navigate(`/login?next=/tours/join/${inviteCode}`);
      return;
    }
    setAccepting(true);
    try {
      const res = await axios.post(`${API}/tours/invite/${inviteCode}/accept`);
      toast.success('Welcome to the tournament! 🎉');
      navigate(`/tours/${res.data.tour_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not accept');
    } finally { setAccepting(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-[#1B3C35]">Loading invitation…</div>
    </div>;
  }

  if (!invite) return null;
  const t = invite.tour || {};

  return (
    <div className="min-h-screen p-4 sm:p-6 flex items-start justify-center pt-12" data-testid="invite-accept-page">
      <Card className="max-w-md w-full border-[#E2E3DD] shadow-lg">
        <div className="h-2 bg-gradient-to-r from-[#1B3C35] to-[#C96A52]" />
        <CardContent className="p-6 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[#C96A52]/10 mx-auto flex items-center justify-center mb-3">
              <Trophy className="h-7 w-7 text-[#C96A52]" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C96A52]">
              Personal Invitation · Virtual Tournament
            </p>
            <h1 className="text-2xl font-bold text-[#1B3C35] mt-2" style={{ fontFamily: 'Outfit' }}>
              {t.name || 'Tournament'}
            </h1>
            {invite.player_name && (
              <p className="text-sm text-[#6B6E66] mt-2">
                For: <span className="font-semibold text-[#1B3C35]">{invite.player_name}</span>
              </p>
            )}
          </div>

          {t.description && (
            <p className="text-sm text-[#6B6E66] whitespace-pre-wrap bg-[#E8E9E3]/30 p-3 rounded-lg text-center">
              {t.description}
            </p>
          )}

          <div className="space-y-2 py-2">
            <Row icon={<Flag className="h-4 w-4 text-[#C96A52]" />}
              label="Your course"
              value={invite.course_name || (t.suggested_course_name
                ? `${t.suggested_course_name} (suggested)` : 'Pick later')} />
            <Row icon={<Calendar className="h-4 w-4 text-[#1B3C35]" />}
              label="Rounds"
              value={`${t.num_rounds || '?'} round${t.num_rounds === 1 ? '' : 's'}`} />
            <Row icon={<Trophy className="h-4 w-4 text-[#1B3C35]" />}
              label="Format"
              value={t.scoring_format === 'stableford' ? 'Stableford (points)' : 'Stroke Play (to par)'} />
            {creatorName && (
              <Row icon={<User2 className="h-4 w-4 text-[#6B6E66]" />}
                label="Organizer"
                value={creatorName} />
            )}
          </div>

          {!user ? (
            <div className="space-y-2">
              <p className="text-xs text-center text-[#6B6E66]">
                You'll need an OnPar Live account to join. It's free and takes 20 seconds.
              </p>
              <Button onClick={accept} className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12"
                data-testid="invite-login-btn">
                <LogIn className="h-4 w-4 mr-1" />
                Sign In or Register
              </Button>
            </div>
          ) : (
            <Button onClick={accept} disabled={accepting}
              className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12"
              data-testid="invite-accept-btn">
              {accepting ? 'Accepting…' : <>Accept and Join <ArrowRight className="h-4 w-4 ml-2" /></>}
            </Button>
          )}

          <p className="text-[10px] text-center text-[#6B6E66]">
            <Check className="h-3 w-3 inline mr-1 text-[#4A5D23]" />
            By accepting you're automatically registered with the assigned course.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-[#E2E3DD] bg-white">
      <div className="w-8 h-8 rounded-full bg-[#E8E9E3] flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold text-[#6B6E66]">{label}</p>
        <p className="text-sm font-semibold text-[#1B3C35] truncate">{value}</p>
      </div>
    </div>
  );
}
