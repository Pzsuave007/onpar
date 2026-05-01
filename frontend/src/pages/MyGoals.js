// /my-goals — goal setup + milestone grid + monthly best-score chart.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Target, Trophy, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { strategyMessage, suggestGoalForHandicap } from '@/lib/goalCoach';

const PRESETS = [100, 95, 90, 85, 80, 75];

export default function MyGoals() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handicap, setHandicap] = useState(null);

  const load = () => axios.get(`${API}/profile/goal`).then(r => setGoal(r.data));

  useEffect(() => {
    Promise.all([
      load(),
      axios.get(`${API}/profile/stats`).catch(() => ({ data: null })),
    ]).then(([_, s]) => {
      setHandicap(s.data?.handicap);
    }).finally(() => setLoading(false));
  }, []);

  const setTarget = async (target_score) => {
    setSaving(true);
    try {
      await axios.put(`${API}/profile/goal`, { target_score, par_baseline: 72 });
      await load();
      setCustom('');
      toast.success(`Goal set: Break ${target_score}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save goal');
    } finally { setSaving(false); }
  };

  const clearGoal = async () => {
    if (!window.confirm('Clear your active goal?')) return;
    setSaving(true);
    try {
      await axios.delete(`${API}/profile/goal`);
      await load();
      toast.success('Goal cleared');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-[#1B3C35]" />
  </div>;

  const active = goal?.active;
  const progress = goal?.progress;
  const milestones = goal?.milestones || {};
  const monthly = goal?.monthly || [];
  const suggested = suggestGoalForHandicap(handicap);

  // Chart bounds for the SVG
  const maxMonthScore = Math.max(...monthly.map(m => m.best), 110, active?.target_score || 90);
  const minMonthScore = Math.min(...monthly.map(m => m.best), 70, active?.target_score || 90);
  const chartHeight = 120;
  const chartWidth = Math.max(monthly.length * 48, 240);

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto fade-in" data-testid="my-goals-page">
      <Button variant="ghost" className="mb-4 text-[#6B6E66]"
        onClick={() => navigate('/dashboard')} data-testid="my-goals-back-btn">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="mb-5">
        <p className="text-xs tracking-[0.2em] uppercase font-bold text-[#C96A52] mb-1">Training</p>
        <h1 className="text-3xl font-bold text-[#1B3C35] flex items-center gap-2" style={{ fontFamily: 'Outfit' }}>
          <Target className="h-7 w-7 text-[#C96A52]" /> My Goal
        </h1>
        <p className="text-sm text-[#6B6E66] mt-1">
          Pick a target score. The Caddie will coach you hole-by-hole and tell you if you're on pace.
        </p>
      </div>

      {/* Active goal card */}
      <Card className="border-[#E2E3DD] shadow-none mb-4" data-testid="active-goal-card">
        <CardContent className="p-5">
          {active ? (
            <>
              <p className="text-xs uppercase tracking-wider text-[#6B6E66] font-bold">Active goal</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-5xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                  Break {active.target_score}
                </p>
                <p className="text-sm text-[#6B6E66]">on par {active.par_baseline}</p>
              </div>
              <p className="text-sm text-[#6B6E66] italic mt-2">
                {strategyMessage(active.target_score, active.par_baseline)}
              </p>
              {progress && (
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#E2E3DD]">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#6B6E66]">Broken</p>
                    <p className="text-xl font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>
                      {progress.broken_count}×
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#6B6E66]">Best since set</p>
                    <p className="text-xl font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>
                      {progress.best_since_set ?? '–'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#6B6E66]">Rounds</p>
                    <p className="text-xl font-bold text-[#1B3C35] tabular-nums" style={{ fontFamily: 'Outfit' }}>
                      {progress.rounds_since_set}
                    </p>
                  </div>
                </div>
              )}
              <Button variant="ghost"
                className="mt-3 text-[#C96A52] hover:bg-[#C96A52]/10 text-xs h-8 px-3"
                onClick={clearGoal} disabled={saving}
                data-testid="goal-clear-btn">
                Clear goal
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wider text-[#6B6E66] font-bold">No active goal</p>
              <p className="text-sm text-[#1B3C35] mt-2">
                Pick a target below. Based on your handicap ({handicap ?? '–'}), we suggest{' '}
                <b>Break {suggested}</b>.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Goal picker */}
      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider">
            {active ? 'Change goal' : 'Pick your goal'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map(p => (
              <button key={p}
                onClick={() => setTarget(p)}
                disabled={saving || active?.target_score === p}
                className={`py-3 rounded-lg border-2 transition-colors ${
                  active?.target_score === p
                    ? 'border-[#C96A52] bg-[#C96A52]/10 text-[#C96A52]'
                    : 'border-[#E2E3DD] text-[#1B3C35] hover:border-[#C96A52]/50'
                } ${p === suggested && !active ? 'ring-2 ring-[#C96A52]/30' : ''}`}
                data-testid={`goal-preset-${p}`}>
                <p className="text-xs uppercase tracking-wider">Break</p>
                <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'Outfit' }}>{p}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input type="number" inputMode="numeric"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="Custom target (e.g. 88)"
              className="flex-1 border-[#E2E3DD]"
              data-testid="goal-custom-input" />
            <Button onClick={() => setTarget(parseInt(custom, 10))}
              disabled={saving || !custom}
              className="bg-[#1B3C35] hover:bg-[#1B3C35]/90"
              data-testid="goal-custom-btn">
              Set
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Milestones grid */}
      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Milestones
          </CardTitle>
          <p className="text-[11px] text-[#6B6E66]">Every barrier you've broken, ever.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(milestones).sort((a, b) => a.target - b.target).map(m => (
              <div key={m.target}
                className={`p-3 rounded-lg border ${m.broken
                  ? 'border-[#4A5D23]/30 bg-[#4A5D23]/5'
                  : 'border-[#E2E3DD]'}`}
                data-testid={`milestone-${m.target}`}>
                <div className="flex items-center gap-2">
                  {m.broken
                    ? <Check className="h-4 w-4 text-[#4A5D23] shrink-0" />
                    : <X className="h-4 w-4 text-[#6B6E66] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1B3C35]">Break {m.target}</p>
                    <p className="text-[10px] text-[#6B6E66]">
                      {m.broken
                        ? `${m.times}× · best ${m.best}`
                        : 'Not yet'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly chart */}
      {monthly.length > 0 && (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-[#1B3C35] uppercase tracking-wider">
              Monthly best score
            </CardTitle>
            <p className="text-[11px] text-[#6B6E66]">Lower is better. Red line = your current goal.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <svg width={chartWidth} height={chartHeight + 30} className="block" data-testid="monthly-chart">
                {/* Y axis grid — 3 lines */}
                {[0, 0.5, 1].map((t, i) => (
                  <line key={i} x1="0" x2={chartWidth} y1={chartHeight * t} y2={chartHeight * t}
                    stroke="#E2E3DD" strokeWidth="1" strokeDasharray="2 2" />
                ))}
                {/* Goal line */}
                {active?.target_score && (() => {
                  const y = chartHeight * (1 - (maxMonthScore - active.target_score) / (maxMonthScore - minMonthScore + 1));
                  return (
                    <>
                      <line x1="0" x2={chartWidth} y1={y} y2={y}
                        stroke="#C96A52" strokeWidth="1.5" strokeDasharray="4 2" />
                      <text x={chartWidth - 8} y={y - 4} fontSize="10" fill="#C96A52" textAnchor="end" fontWeight="bold">
                        Goal {active.target_score}
                      </text>
                    </>
                  );
                })()}
                {/* Bars */}
                {monthly.map((m, i) => {
                  const barW = 36;
                  const x = i * 48 + 4;
                  const range = Math.max(1, maxMonthScore - minMonthScore);
                  const barH = Math.max(4, ((maxMonthScore - m.best) / range) * chartHeight);
                  const y = chartHeight - barH;
                  const goalLine = active?.target_score;
                  const fill = goalLine && m.best < goalLine ? '#4A5D23' : '#1B3C35';
                  return (
                    <g key={m.month}>
                      <rect x={x} y={y} width={barW} height={barH} fill={fill} rx="4" />
                      <text x={x + barW / 2} y={y - 4} fontSize="10" fill="#1B3C35" textAnchor="middle" fontWeight="bold">
                        {m.best}
                      </text>
                      <text x={x + barW / 2} y={chartHeight + 16} fontSize="9" fill="#6B6E66" textAnchor="middle">
                        {m.month.slice(5)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
