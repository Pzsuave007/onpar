// Dedicated Round History page with filters.
// Uses the existing GET /api/rounds/my endpoint and filters client-side.
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/DatePicker';
import { ArrowLeft, Flag, Calendar, Filter, Search, Trophy, TrendingDown, TrendingUp } from 'lucide-react';

function fmt(s) { return s === 0 ? 'E' : s > 0 ? `+${s}` : `${s}`; }
function clr(s) { return s < 0 ? 'text-[#C96A52]' : s > 0 ? 'text-[#1D2D44]' : 'text-[#4A5D23]'; }

export default function RoundHistory() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  // Filters
  const [courseFilter, setCourseFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    axios.get(`${API}/rounds/my`).then(res => setRounds(res.data || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const courses = useMemo(() => {
    const names = new Set();
    rounds.forEach(r => r.course_name && names.add(r.course_name));
    return Array.from(names).sort();
  }, [rounds]);

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return rounds.filter(r => {
      if (courseFilter !== 'all' && r.course_name !== courseFilter) return false;
      if (sourceFilter !== 'all') {
        const src = r.source || 'manual';
        if (src !== sourceFilter) return false;
      }
      if (startDate && (r.created_at || '').split('T')[0] < startDate) return false;
      if (endDate && (r.created_at || '').split('T')[0] > endDate) return false;
      if (qLower && !(r.course_name || '').toLowerCase().includes(qLower)) return false;
      return true;
    });
  }, [rounds, courseFilter, sourceFilter, startDate, endDate, q]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const totals = filtered.map(r => r.total_to_par || 0);
    const best = Math.min(...totals);
    const worst = Math.max(...totals);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return { count: filtered.length, best, worst, avg: Math.round(avg * 10) / 10 };
  }, [filtered]);

  const resetFilters = () => {
    setCourseFilter('all'); setSourceFilter('all');
    setStartDate(''); setEndDate(''); setQ('');
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto fade-in" data-testid="round-history-page">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="history-back-btn">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#C96A52]">My Rounds</p>
          <h1 className="text-2xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>Round History</h1>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="Rounds" value={stats.count} icon={<Flag className="h-4 w-4" />} />
          <StatCard label="Best" value={fmt(stats.best)} valueClr={clr(stats.best)}
            icon={<TrendingDown className="h-4 w-4 text-[#C96A52]" />} />
          <StatCard label="Worst" value={fmt(stats.worst)} valueClr={clr(stats.worst)}
            icon={<TrendingUp className="h-4 w-4 text-[#1D2D44]" />} />
          <StatCard label="Average" value={fmt(Math.round(stats.avg))} valueClr={clr(Math.round(stats.avg))}
            icon={<Trophy className="h-4 w-4 text-[#4A5D23]" />} />
        </div>
      )}

      {/* Filters */}
      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#C96A52]" />
            <p className="text-sm font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>Filter rounds</p>
            <button onClick={resetFilters}
              className="ml-auto text-[11px] text-[#C96A52] hover:text-[#1B3C35] font-bold"
              data-testid="reset-filters-btn">
              Reset
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B6E66]" />
              <Input placeholder="Search course…" value={q} onChange={e => setQ(e.target.value)}
                className="pl-8 h-10 border-[#E2E3DD]" data-testid="history-search" />
            </div>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-10 border-[#E2E3DD]" data-testid="filter-course">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-10 border-[#E2E3DD]" data-testid="filter-source">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any source</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="live_scoring">Live Scoring</SelectItem>
                <SelectItem value="challenge_log">Challenge</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker value={startDate} onChange={setStartDate} placeholder="From" testId="filter-start" />
              <DatePicker value={endDate} onChange={setEndDate} placeholder="To" testId="filter-end" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <p className="text-center py-10 text-[#6B6E66]">Loading rounds…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="py-12 text-center">
            <Flag className="h-10 w-10 text-[#D6D7D2] mx-auto mb-3" />
            <p className="text-sm text-[#6B6E66]">
              {rounds.length === 0 ? 'No rounds yet.' : 'No rounds match those filters.'}
            </p>
            {rounds.length === 0 && (
              <Button className="mt-4 bg-[#C96A52] hover:bg-[#C96A52]/90"
                onClick={() => navigate('/play')}>
                Play your first round
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.round_id} className="border-[#E2E3DD] shadow-none hover:shadow-md transition-shadow"
              data-testid={`round-row-${r.round_id}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1B3C35] truncate">{r.course_name || 'No course'}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#6B6E66]">
                    <Calendar className="h-3 w-3" />
                    {(r.created_at || '').split('T')[0]}
                    <span>·</span>
                    <span>{r.total_strokes || 0} strokes</span>
                    {r.source && r.source !== 'manual' && (
                      <Badge className="bg-[#E8E9E3] text-[#1B3C35] hover:bg-[#E8E9E3] text-[9px] py-0 px-1.5">
                        {r.source.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
                <span className={`font-bold text-lg tabular-nums ${clr(r.total_to_par || 0)}`}>
                  {fmt(r.total_to_par || 0)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, valueClr = 'text-[#1B3C35]', icon }) {
  return (
    <Card className="border-[#E2E3DD] shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[#6B6E66]">
          {icon}{label}
        </div>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${valueClr}`} style={{ fontFamily: 'Outfit' }}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
