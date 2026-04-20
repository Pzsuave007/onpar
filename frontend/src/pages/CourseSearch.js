import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Search, Loader2, Save, MapPin, Check } from 'lucide-react';

export default function CourseSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const res = await axios.post(`${API}/courses/search`, { query: query.trim() });
      if (res.data.status === 'found') {
        setResult(res.data.data);
      } else {
        toast.error(res.data.message || 'Course not found');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const tees = result.tees.map(t => ({
        name: t.name,
        color: t.color,
        holes: t.holes,
        total_par: t.holes.reduce((s, h) => s + h.par, 0),
        total_yardage: t.holes.reduce((s, h) => s + (h.yards || 0), 0)
      }));
      await axios.post(`${API}/courses`, {
        course_name: result.course_name,
        num_holes: result.num_holes || 18,
        tees
      });
      toast.success('Course saved!');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto" data-testid="course-search">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#E8E9E3] flex items-center justify-center text-[#1B3C35] active:scale-95"
          data-testid="back-btn">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            Find a Course
          </h1>
          <p className="text-xs text-[#6B6E66]">AI searches the web for scorecard data</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Course name + city (e.g. Pebble Beach CA)"
          className="flex-1 border-[#E2E3DD] h-12 text-base"
          data-testid="course-search-input"
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={searching || !query.trim()}
          className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12 px-5"
          data-testid="course-search-btn">
          {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </Button>
      </div>

      {/* Searching state */}
      {searching && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 text-[#1B3C35] animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#6B6E66]">Searching the web for scorecard...</p>
          <p className="text-xs text-[#6B6E66] mt-1">This may take a few seconds</p>
        </div>
      )}

      {/* Results */}
      {result && !searching && (
        <div>
          {/* Course info */}
          <Card className="border-[#E2E3DD] shadow-none mb-4 overflow-hidden">
            <div className="bg-[#1B3C35] px-4 py-3">
              <h2 className="text-white font-bold text-lg" style={{ fontFamily: 'Outfit' }}>
                {result.course_name}
              </h2>
              {result.location && (
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{result.location}
                </p>
              )}
            </div>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-[#4A5D23]/10 text-[#4A5D23] border-[#4A5D23]/20 hover:bg-[#4A5D23]/10">
                  {result.num_holes || 18} Holes
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {result.tees?.length || 0} Tees found
                </Badge>
              </div>

              {/* Tees */}
              {result.tees?.map((tee, ti) => (
                <div key={ti} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: tee.color === '#FFFFFF' ? '#F5F5F5' : tee.color }} />
                    <span className="text-sm font-bold text-[#1B3C35]">{tee.name}</span>
                    <span className="text-xs text-[#6B6E66]">
                      Par {tee.holes?.reduce((s, h) => s + h.par, 0)} &middot; {tee.holes?.reduce((s, h) => s + (h.yards || 0), 0)} yds
                    </span>
                  </div>
                  {/* Compact hole grid */}
                  <div className="grid grid-cols-9 gap-0.5 text-center">
                    {tee.holes?.slice(0, 9).map(h => (
                      <div key={h.hole} className="bg-[#E8E9E3]/60 rounded px-0.5 py-1">
                        <div className="text-[8px] text-[#6B6E66] font-bold">{h.hole}</div>
                        <div className="text-xs font-bold text-[#1B3C35]">{h.par}</div>
                        <div className="text-[8px] text-[#6B6E66]">{h.yards}</div>
                      </div>
                    ))}
                  </div>
                  {tee.holes?.length > 9 && (
                    <div className="grid grid-cols-9 gap-0.5 text-center mt-0.5">
                      {tee.holes?.slice(9).map(h => (
                        <div key={h.hole} className="bg-[#E8E9E3]/60 rounded px-0.5 py-1">
                          <div className="text-[8px] text-[#6B6E66] font-bold">{h.hole}</div>
                          <div className="text-xs font-bold text-[#1B3C35]">{h.par}</div>
                          <div className="text-[8px] text-[#6B6E66]">{h.yards}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-14 text-base"
              onClick={handleSave} disabled={saving} data-testid="save-course-btn">
              {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              {saving ? 'Saving...' : 'Looks Good — Save Course'}
            </Button>
            <Button variant="outline" className="w-full border-[#E2E3DD] h-10"
              onClick={() => { setResult(null); setQuery(''); }}
              data-testid="search-again-btn">
              Search Again
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !searching && (
        <div className="text-center py-12">
          <Search className="h-10 w-10 text-[#D6D7D2] mx-auto mb-3" />
          <p className="text-sm text-[#6B6E66]">Enter a golf course name to search</p>
          <p className="text-xs text-[#6B6E66] mt-1">Example: "Indian Canyon Golf Course Spokane"</p>
        </div>
      )}
    </div>
  );
}
