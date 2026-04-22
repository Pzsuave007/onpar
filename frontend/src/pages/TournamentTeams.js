// Admin-only page to create and manage teams for a Best Ball tournament.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ArrowLeft, Shuffle, Plus, Trash2, Users, Share2, Pencil, Check, X } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';

export default function TournamentTeams() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [roster, setRoster] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [newTeamName, setNewTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editName, setEditName] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [t, r, tm] = await Promise.all([
        axios.get(`${API}/tournaments/${tournamentId}`),
        axios.get(`${API}/tournaments/${tournamentId}/roster`),
        axios.get(`${API}/tournaments/${tournamentId}/teams`)
      ]);
      setTournament(t.data);
      setRoster(r.data || []);
      setTeams(tm.data || []);
    } catch (err) {
      toast.error('Failed to load');
    } finally { setLoading(false); }
  }, [tournamentId]);

  useEffect(() => { refresh(); }, [refresh]);

  const inATeam = new Set(teams.flatMap(t => t.members || []));
  const available = roster.filter(r => !inATeam.has(r.user_id));

  const toggle = (uid) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const createTeam = async () => {
    const teamSize = tournament?.team_size || 2;
    if (selectedIds.size > teamSize) {
      toast.error(`Max ${teamSize} players per team`);
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/tournaments/${tournamentId}/teams`, {
        name: newTeamName.trim() || `Team ${teams.length + 1}`,
        member_ids: Array.from(selectedIds)
      });
      toast.success('Team created');
      setSelectedIds(new Set());
      setNewTeamName('');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setBusy(false); }
  };

  const autoForm = async () => {
    if (!window.confirm('Auto-form teams? This will replace all existing teams.')) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/tournaments/${tournamentId}/teams/auto`);
      toast.success(`Formed ${res.data.count} teams`);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setBusy(false); }
  };

  const deleteTeam = async (teamId) => {
    if (!window.confirm('Delete this team?')) return;
    try {
      await axios.delete(`${API}/tournaments/${tournamentId}/teams/${teamId}`);
      toast.success('Team deleted');
      refresh();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const saveTeamName = async (team) => {
    try {
      await axios.put(`${API}/tournaments/${tournamentId}/teams/${team.team_id}`, {
        name: editName.trim() || team.name,
        member_ids: team.members || []
      });
      toast.success('Team renamed');
      setEditingTeam(null);
      refresh();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const removeFromTeam = async (team, uid) => {
    try {
      await axios.put(`${API}/tournaments/${tournamentId}/teams/${team.team_id}`, {
        name: team.name,
        member_ids: (team.members || []).filter(m => m !== uid)
      });
      refresh();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const shareInvite = () => {
    if (!tournament?.invite_code) {
      toast.error('No invite link');
      return;
    }
    const url = `${window.location.origin}/tournaments/join/${tournament.invite_code}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!'));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-[#1B3C35]">Loading...</div>
    </div>;
  }
  if (!tournament) return null;

  const teamSize = tournament.team_size || 2;

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-2xl mx-auto fade-in" data-testid="tournament-teams-page">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs tracking-[0.15em] uppercase font-bold text-[#C96A52]">Best Ball · Teams</p>
          <h1 className="text-lg font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>
            {tournament.name}
          </h1>
        </div>
        <Button size="sm" variant="outline" className="border-[#1B3C35] text-[#1B3C35]" onClick={shareInvite}
          data-testid="share-invite-btn">
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5 text-center">
        <div className="bg-[#E8E9E3]/50 rounded-xl p-3">
          <p className="text-[9px] text-[#6B6E66] uppercase font-bold tracking-wider">Players</p>
          <p className="text-lg font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>{roster.length}</p>
        </div>
        <div className="bg-[#E8E9E3]/50 rounded-xl p-3">
          <p className="text-[9px] text-[#6B6E66] uppercase font-bold tracking-wider">Team Size</p>
          <p className="text-lg font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>{teamSize}</p>
        </div>
        <div className="bg-[#E8E9E3]/50 rounded-xl p-3">
          <p className="text-[9px] text-[#6B6E66] uppercase font-bold tracking-wider">Teams</p>
          <p className="text-lg font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>{teams.length}</p>
        </div>
      </div>

      {/* Existing teams */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider">Teams</p>
          {roster.length > 1 && (
            <Button size="sm" variant="outline" className="border-[#E2E3DD] text-[#1B3C35]"
              onClick={autoForm} disabled={busy} data-testid="auto-form-btn">
              <Shuffle className="h-3.5 w-3.5 mr-1" />Auto-form
            </Button>
          )}
        </div>
        {teams.length === 0 ? (
          <Card className="border-dashed border-[#D6D7D2] shadow-none">
            <CardContent className="py-6 text-center">
              <Users className="h-8 w-8 text-[#D6D7D2] mx-auto mb-2" />
              <p className="text-xs text-[#6B6E66]">No teams yet. Create one below or use Auto-form.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {teams.map(t => (
              <Card key={t.team_id} className="border-[#E2E3DD] shadow-none" data-testid={`team-${t.team_id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    {editingTeam === t.team_id ? (
                      <div className="flex-1 flex gap-1">
                        <Input value={editName} onChange={e => setEditName(e.target.value)}
                          className="h-8 text-sm border-[#E2E3DD]" autoFocus />
                        <Button size="sm" className="h-8 bg-[#1B3C35]" onClick={() => saveTeamName(t)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8"
                          onClick={() => setEditingTeam(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-[#1B3C35] flex-1">{t.name}</p>
                        <div className="flex items-center gap-1">
                          <Badge className="bg-[#E8E9E3] text-[#6B6E66] hover:bg-[#E8E9E3] text-[10px]">
                            {(t.members || []).length}/{teamSize}
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={() => { setEditingTeam(t.team_id); setEditName(t.name); }}>
                            <Pencil className="h-3.5 w-3.5 text-[#6B6E66]" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={() => deleteTeam(t.team_id)}>
                            <Trash2 className="h-3.5 w-3.5 text-[#C96A52]" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  {(t.members_detail || []).length === 0 ? (
                    <p className="text-xs text-[#6B6E66] italic">No members yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(t.members_detail || []).map(m => (
                        <div key={m.user_id}
                          className="flex items-center gap-1.5 bg-[#E8E9E3]/60 rounded-full pr-2 pl-0.5 py-0.5">
                          <PlayerAvatar name={m.name} url={m.avatar_url} size="xs" />
                          <span className="text-xs text-[#1B3C35]">{m.name}</span>
                          <button onClick={() => removeFromTeam(t, m.user_id)}
                            className="text-[#6B6E66] hover:text-[#C96A52]">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create new team */}
      <div>
        <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">
          Create New Team {available.length === 0 ? '— all players assigned ✓' : ''}
        </p>
        {available.length > 0 && (
          <Card className="border-[#E2E3DD] shadow-none">
            <CardContent className="p-3 space-y-3">
              <Input value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                placeholder={`Team ${teams.length + 1} name (optional)`}
                className="border-[#E2E3DD]" data-testid="new-team-name" />
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {available.map(r => {
                  const checked = selectedIds.has(r.user_id);
                  return (
                    <label key={r.user_id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer ${checked ? 'border-[#1B3C35] bg-[#1B3C35]/5' : 'border-[#E2E3DD]'}`}
                      data-testid={`roster-pick-${r.user_id}`}>
                      <Checkbox checked={checked} onCheckedChange={() => toggle(r.user_id)} />
                      <PlayerAvatar name={r.player_name} url={r.avatar_url} size="sm" />
                      <span className="text-sm font-medium text-[#1B3C35] truncate">{r.player_name}</span>
                    </label>
                  );
                })}
              </div>
              <Button onClick={createTeam} disabled={busy || selectedIds.size === 0}
                className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90" data-testid="create-team-btn">
                <Plus className="h-4 w-4 mr-1" />
                Create Team{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
