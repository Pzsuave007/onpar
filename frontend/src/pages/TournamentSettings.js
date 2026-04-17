import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Pencil, Trash2, Check, X, Users } from 'lucide-react';

export default function TournamentSettings() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const fetchData = async () => {
    try {
      const [tRes, rRes] = await Promise.all([
        axios.get(`${API}/tournaments/${tournamentId}`),
        axios.get(`${API}/tournaments/${tournamentId}/roster`)
      ]);
      setTournament(tRes.data);
      setRoster(rRes.data);
    } catch {
      toast.error('Failed to load tournament');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tournamentId]);

  const addPlayer = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await axios.post(`${API}/tournaments/${tournamentId}/add-player`, { name: newName.trim() });
      toast.success(`${newName.trim()} added!`);
      setNewName('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const renamePlayer = async (userId) => {
    if (!editName.trim()) return;
    try {
      await axios.put(`${API}/tournaments/${tournamentId}/player/${userId}`, { name: editName.trim() });
      toast.success('Name updated!');
      setEditingId(null);
      setEditName('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to rename');
    }
  };

  const removePlayer = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from the tournament?`)) return;
    try {
      await axios.delete(`${API}/tournaments/${tournamentId}/player/${userId}`);
      toast.success(`${name} removed`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#6B6E66]">Tournament not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto" data-testid="tournament-settings">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="back-btn">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[#1B3C35] truncate" style={{ fontFamily: 'Outfit' }}>
            {tournament.name}
          </h1>
          <p className="text-xs text-[#6B6E66]">{tournament.course_name} &middot; {tournament.num_holes} holes</p>
        </div>
        <Badge className={tournament.status === 'active'
          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
          : tournament.status === 'upcoming'
          ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100'
          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'}>
          {tournament.status}
        </Badge>
      </div>

      {/* Add Player */}
      <div className="mb-6">
        <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">
          <UserPlus className="h-3.5 w-3.5 inline mr-1" />Add Player
        </p>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Player name..."
            className="flex-1 border-[#E2E3DD] h-12 text-base"
            data-testid="add-player-input"
            onKeyDown={e => e.key === 'Enter' && addPlayer()}
          />
          <Button onClick={addPlayer} disabled={adding || !newName.trim()}
            className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12 px-5"
            data-testid="add-player-btn">
            <UserPlus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Players List */}
      <div>
        <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider mb-2">
          <Users className="h-3.5 w-3.5 inline mr-1" />Players ({roster.length})
        </p>

        {roster.length === 0 ? (
          <Card className="border-[#E2E3DD] shadow-none">
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 text-[#D6D7D2] mx-auto mb-3" />
              <p className="text-sm text-[#6B6E66]">No players yet. Add the first one above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {roster.map((p, i) => (
              <Card key={p.user_id} className="border-[#E2E3DD] shadow-none" data-testid={`player-card-${p.user_id}`}>
                <CardContent className="p-3">
                  {editingId === p.user_id ? (
                    /* Edit mode */
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 border-[#E2E3DD] h-10 text-base"
                        autoFocus
                        data-testid={`edit-name-input-${p.user_id}`}
                        onKeyDown={e => {
                          if (e.key === 'Enter') renamePlayer(p.user_id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button onClick={() => renamePlayer(p.user_id)}
                        className="w-10 h-10 rounded-full bg-[#4A5D23] flex items-center justify-center text-white active:scale-95"
                        data-testid={`save-name-${p.user_id}`}>
                        <Check className="h-5 w-5" />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#6B6E66] active:scale-95">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#1B3C35] flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[#1B3C35] truncate">{p.player_name}</p>
                          <p className="text-[10px] text-[#6B6E66]">{p.email || 'Guest player'}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => { setEditingId(p.user_id); setEditName(p.player_name); }}
                          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#6B6E66] hover:bg-[#D6D7D2] active:scale-95"
                          data-testid={`edit-player-${p.user_id}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => removePlayer(p.user_id, p.player_name)}
                          className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 active:scale-95"
                          data-testid={`remove-player-${p.user_id}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
