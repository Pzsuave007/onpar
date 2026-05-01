// Admin-only tool to pin green coordinates for each hole of a course
// using Google Maps coords (right-click → copy coordinates).
// Lives inside AdminPanel as a dedicated tab.
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flag, ExternalLink, Trash2, Check } from 'lucide-react';

// Accepts:
//   "47.651506, -117.373635"
//   "47.651506,-117.373635"
//   "https://maps.google.com/?q=47.651506,-117.373635"
//   "https://www.google.com/maps/@47.651506,-117.373635,20z"
//   "https://www.google.com/maps/place/.../@47.651506,-117.373635,19z/..."
function parseCoords(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Try straight "lat, lng"
  let m = s.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // Try URL @lat,lng
  m = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  // Try URL ?q=lat,lng
  m = s.match(/[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

function validCoords(c) {
  return c && c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180;
}

function getHoleList(course) {
  // Prefer tees[0].holes (primary structure); fall back to flat holes
  const tee = (course?.tees || [])[0];
  if (tee?.holes?.length) return tee.holes;
  return course?.holes || [];
}

const OWNER_EMAIL = 'pzsuave007@gmail.com';

export default function PinGreensTab() {
  const { user } = useAuth();
  const isOwner = (user?.email || '').toLowerCase() === OWNER_EMAIL;
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [inputs, setInputs] = useState({}); // {holeNum: "raw string"}
  const [busy, setBusy] = useState({}); // {holeNum: true}

  useEffect(() => {
    axios.get(`${API}/courses`).then(r => setCourses(r.data)).catch(() => {});
  }, []);

  const course = useMemo(
    () => courses.find(c => c.course_id === courseId),
    [courses, courseId]
  );
  const holes = useMemo(() => getHoleList(course), [course]);

  const refreshCourse = async () => {
    const r = await axios.get(`${API}/courses`);
    setCourses(r.data);
  };

  const savePin = async (hole) => {
    const parsed = parseCoords(inputs[hole.hole || hole.number]);
    if (!validCoords(parsed)) {
      toast.error('Invalid coordinates. Paste the lat,lng from Google Maps.');
      return;
    }
    setBusy(b => ({ ...b, [hole.hole || hole.number]: true }));
    try {
      // Admin bypasses accuracy check. Send accuracy=1 so logs show intent.
      await axios.put(
        `${API}/courses/${courseId}/holes/${hole.hole || hole.number}/green-pin`,
        { lat: parsed.lat, lng: parsed.lng, accuracy: 1 }
      );
      toast.success(`✓ Hoyo ${hole.hole || hole.number} pinneado`);
      setInputs(i => ({ ...i, [hole.hole || hole.number]: '' }));
      await refreshCourse();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al guardar');
    } finally {
      setBusy(b => ({ ...b, [hole.hole || hole.number]: false }));
    }
  };

  const removePin = async (hole) => {
    const n = hole.hole || hole.number;
    if (!window.confirm(`¿Borrar el pin del hoyo ${n}?`)) return;
    setBusy(b => ({ ...b, [n]: true }));
    try {
      await axios.delete(`${API}/courses/${courseId}/holes/${n}/green-pin`);
      toast.success(`Pin del hoyo ${n} borrado`);
      await refreshCourse();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al borrar');
    } finally {
      setBusy(b => ({ ...b, [n]: false }));
    }
  };

  return (
    <div className="space-y-4" data-testid="pin-greens-tab-content">
      <Card className="border-[#E2E3DD] shadow-none bg-[#F4E9D8]/40">
        <CardContent className="py-4 text-sm text-[#1B3C35] space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <Flag className="h-4 w-4 text-[#C96A52]" /> Pinear greens desde Google Maps
          </p>
          <p className="text-xs text-[#6B6E66]">
            1. Abrí Google Maps, buscá el curso y ubicá el centro del green.
            2. Clic derecho sobre el centro del green → aparecen las coordenadas (ej. <code className="bg-white px-1 rounded">47.651506, -117.373635</code>) → clic para copiar.
            3. Pegá en el input del hoyo correspondiente y dale "Guardar".
          </p>
        </CardContent>
      </Card>

      <div>
        <Label className="text-[#1B3C35] text-sm font-bold">Curso</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="mt-1 border-[#E2E3DD]" data-testid="pin-greens-course-select">
            <SelectValue placeholder="Elegí un curso..." />
          </SelectTrigger>
          <SelectContent>
            {courses.map(c => (
              <SelectItem key={c.course_id} value={c.course_id}>
                {c.course_name || c.name} {c.total_par ? `(Par ${c.total_par})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {courseId && holes.length === 0 && (
        <p className="text-sm text-[#6B6E66] py-8 text-center">
          Este curso no tiene hoyos configurados todavía.
        </p>
      )}

      {holes.length > 0 && (
        <Card className="border-[#E2E3DD] shadow-none">
          <CardContent className="p-0">
            <div className="divide-y divide-[#E2E3DD]">
              {/* Header */}
              <div className="grid grid-cols-[44px_40px_1fr_auto] gap-2 items-center py-2 px-3 bg-[#E8E9E3]/50 text-[10px] font-bold text-[#6B6E66] uppercase tracking-wider">
                <span>Hoyo</span>
                <span>Par</span>
                <span>Coordenadas</span>
                <span></span>
              </div>
              {holes.map((h) => {
                const n = h.hole || h.number;
                const pinned = h.green_lat != null && h.green_lng != null;
                const raw = inputs[n] || '';
                return (
                  <div key={n}
                    className="grid grid-cols-[44px_40px_1fr_auto] gap-2 items-center py-2.5 px-3"
                    data-testid={`pin-green-row-${n}`}>
                    <span className="text-sm font-bold text-[#1B3C35] tabular-nums">{n}</span>
                    <span className="text-sm text-[#6B6E66] tabular-nums">{h.par ?? '-'}</span>
                    <div className="min-w-0">
                      {pinned ? (
                        <div className="flex items-center gap-2 text-xs">
                          <Check className="h-3.5 w-3.5 text-[#4A5D23] shrink-0" />
                          <span className="tabular-nums text-[#1B3C35] truncate">
                            {h.green_lat.toFixed(6)}, {h.green_lng.toFixed(6)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${h.green_lat},${h.green_lng}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[#C96A52] hover:underline inline-flex items-center gap-0.5 shrink-0"
                            data-testid={`pin-green-view-${n}`}>
                            <ExternalLink className="h-3 w-3" /> Ver
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-[#6B6E66]">Sin pinear</span>
                      )}
                      <Input
                        value={raw}
                        onChange={e => setInputs(i => ({ ...i, [n]: e.target.value }))}
                        placeholder='Paste coordinates here'
                        className="h-8 mt-1 border-[#E2E3DD] text-xs font-mono placeholder:italic placeholder:text-[#9DA09A]"
                        data-testid={`pin-green-input-${n}`}
                        disabled={busy[n]}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        className="h-7 px-2 bg-[#1B3C35] hover:bg-[#1B3C35]/90 text-xs"
                        disabled={busy[n] || !raw.trim()}
                        onClick={() => savePin(h)}
                        data-testid={`pin-green-save-${n}`}>
                        {busy[n] ? '…' : 'Guardar'}
                      </Button>
                      {pinned && isOwner && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-xs border-[#E2E3DD] text-[#C96A52] hover:bg-[#C96A52]/10"
                          disabled={busy[n]}
                          onClick={() => removePin(h)}
                          data-testid={`pin-green-delete-${n}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
