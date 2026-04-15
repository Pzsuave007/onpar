import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save, Send } from 'lucide-react';

function calcStableford(strokes, par) {
  if (strokes === 0) return 0;
  const diff = strokes - par;
  if (diff >= 2) return 0;
  if (diff === 1) return 1;
  if (diff === 0) return 2;
  if (diff === -1) return 3;
  if (diff === -2) return 4;
  return 5;
}

export default function ScorecardEntry() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [holes, setHoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, scRes] = await Promise.all([
          axios.get(`${API}/tournaments/${tournamentId}`),
          axios.get(`${API}/scorecards/tournament/${tournamentId}/my`)
        ]);
        const t = tRes.data;
        setTournament(t);

        if (scRes.data && scRes.data.holes) {
          setHoles(scRes.data.holes);
        } else {
          setHoles(t.par_per_hole.map((par, i) => ({ hole: i + 1, par, strokes: 0 })));
        }
      } catch {
        toast.error('Failed to load tournament');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tournamentId, navigate]);

  const updateHole = (index, strokes) => {
    const val = parseInt(strokes) || 0;
    if (val < 0 || val > 15) return;
    setHoles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], strokes: val };
      return updated;
    });
  };

  const saveScorecard = async (forceSubmit = false) => {
    setSaving(true);
    try {
      await axios.post(`${API}/scorecards`, {
        tournament_id: tournamentId,
        round_number: 1,
        holes
      });
      toast.success(forceSubmit ? 'Scorecard submitted!' : 'Progress saved!');
      if (forceSubmit) navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to save scorecard');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#1B3C35]">Loading scorecard...</div>
      </div>
    );
  }

  const front9 = holes.slice(0, Math.min(9, holes.length));
  const back9 = holes.length > 9 ? holes.slice(9) : [];
  const played = holes.filter(h => h.strokes > 0);
  const totalStrokes = played.reduce((s, h) => s + h.strokes, 0);
  const totalPar = played.reduce((s, h) => s + h.par, 0);
  const toPar = totalStrokes - totalPar;
  const stablefordPts = played.reduce((s, h) => s + calcStableford(h.strokes, h.par), 0);
  const allFilled = holes.every(h => h.strokes > 0);

  const formatScore = (s) => s === 0 ? 'E' : s > 0 ? `+${s}` : `${s}`;
  const scoreColor = (s) => s < 0 ? 'text-[#C96A52]' : s > 0 ? 'text-[#1D2D44]' : 'text-[#4A5D23]';

  const HoleGrid = ({ holeSet, label }) => {
    const setStrokes = holeSet.reduce((s, h) => s + h.strokes, 0);
    const setPar = holeSet.reduce((s, h) => s + h.par, 0);
    return (
      <div className="mb-6">
        <h3 className="text-sm font-bold text-[#6B6E66] uppercase tracking-wider mb-3">{label}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid={`scorecard-${label.toLowerCase().replace(' ', '-')}`}>
            <thead>
              <tr className="border-b border-[#E2E3DD]">
                <th className="text-left py-2 px-2 text-xs text-[#6B6E66] font-bold uppercase tracking-wider w-16">Hole</th>
                {holeSet.map(h => (
                  <th key={h.hole} className="py-2 px-1 text-center text-[#1B3C35] font-bold min-w-[3rem]">{h.hole}</th>
                ))}
                <th className="py-2 px-2 text-center text-[#1B3C35] font-bold bg-[#E8E9E3]/50 min-w-[3rem]">
                  {label === 'Front 9' ? 'OUT' : 'IN'}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E2E3DD]">
                <td className="py-2 px-2 text-xs text-[#6B6E66] font-bold uppercase tracking-wider">Par</td>
                {holeSet.map(h => (
                  <td key={h.hole} className="py-2 px-1 text-center text-[#6B6E66] tabular-nums">{h.par}</td>
                ))}
                <td className="py-2 px-2 text-center font-bold text-[#6B6E66] bg-[#E8E9E3]/50 tabular-nums">{setPar}</td>
              </tr>
              <tr>
                <td className="py-2 px-2 text-xs text-[#6B6E66] font-bold uppercase tracking-wider">Score</td>
                {holeSet.map((h, i) => {
                  const idx = label === 'Front 9' ? i : i + 9;
                  const diff = h.strokes > 0 ? h.strokes - h.par : null;
                  let cellBg = '';
                  if (diff !== null) {
                    if (diff < 0) cellBg = 'bg-[#C96A52]/10';
                    else if (diff > 0) cellBg = 'bg-[#1D2D44]/10';
                    else cellBg = 'bg-[#4A5D23]/10';
                  }
                  return (
                    <td key={h.hole} className={`py-1 px-1 text-center ${cellBg}`}>
                      <input
                        type="number"
                        min="0"
                        max="15"
                        value={h.strokes || ''}
                        onChange={e => updateHole(idx, e.target.value)}
                        className="scorecard-input w-10 h-8 rounded border border-[#E2E3DD] bg-white text-[#1B3C35] text-sm font-medium focus:ring-1 focus:ring-[#1B3C35]"
                        data-testid={`hole-input-${h.hole}`}
                      />
                    </td>
                  );
                })}
                <td className="py-2 px-2 text-center font-bold text-[#1B3C35] bg-[#E8E9E3]/50 tabular-nums">
                  {setStrokes || '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto fade-in" data-testid="scorecard-entry">
      <Button variant="ghost" className="mb-4 text-[#6B6E66]" onClick={() => navigate('/dashboard')} data-testid="back-to-dashboard">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
      </Button>

      <Card className="border-[#E2E3DD] shadow-none mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                {tournament.name}
              </CardTitle>
              <p className="text-sm text-[#6B6E66] mt-1">{tournament.course_name} &middot; Round 1</p>
            </div>
            <Badge variant="outline" className="capitalize text-xs">{tournament.scoring_format} play</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <HoleGrid holeSet={front9} label="Front 9" />
          {back9.length > 0 && <HoleGrid holeSet={back9} label="Back 9" />}

          {/* Totals */}
          <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-[#E2E3DD]">
            <div data-testid="total-strokes">
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">Total</p>
              <p className="text-2xl font-bold text-[#1B3C35] tabular-nums">{totalStrokes || '-'}</p>
            </div>
            <div data-testid="total-to-par">
              <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">To Par</p>
              <p className={`text-2xl font-bold tabular-nums ${played.length > 0 ? scoreColor(toPar) : 'text-[#6B6E66]'}`}>
                {played.length > 0 ? formatScore(toPar) : '-'}
              </p>
            </div>
            {tournament.scoring_format === 'stableford' && (
              <div data-testid="stableford-points">
                <p className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold">Stableford</p>
                <p className="text-2xl font-bold text-[#1B3C35] tabular-nums">{stablefordPts}</p>
              </div>
            )}
            <div className="text-xs text-[#6B6E66]">
              {played.length}/{holes.length} holes completed
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Button variant="outline" className="border-[#E2E3DD] text-[#1B3C35]" onClick={() => saveScorecard(false)}
              disabled={saving} data-testid="save-progress-btn">
              <Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save Progress'}
            </Button>
            <Button className="bg-[#1B3C35] hover:bg-[#1B3C35]/90" onClick={() => saveScorecard(true)}
              disabled={saving || !allFilled} data-testid="submit-scorecard-btn">
              <Send className="h-4 w-4 mr-1" />{saving ? 'Submitting...' : allFilled ? 'Submit Scorecard' : `Complete All ${holes.length} Holes`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
