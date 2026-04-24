// "Mi Bolsa" page — personal club distances, fully personalizable.
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Trash2, ArrowLeft, Save, GripVertical } from 'lucide-react';

export default function MyBag() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/profile/clubs`);
        setClubs(r.data.clubs || []);
      } catch {
        toast.error('No pude cargar tu bolsa');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateClub = (i, patch) => {
    setClubs(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c));
    setDirty(true);
  };
  const bumpDistance = (i, delta) =>
    updateClub(i, { distance_yards: Math.max(0, Math.min(400, (Number(clubs[i].distance_yards) || 0) + delta)) });

  const removeClub = (i) => {
    setClubs(cs => cs.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const addClub = () => {
    setClubs(cs => [...cs, { name: '', distance_yards: 0 }]);
    setDirty(true);
  };

  const moveClub = (from, to) => {
    if (to < 0 || to >= clubs.length) return;
    setClubs(cs => {
      const next = [...cs];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    const cleaned = clubs
      .map(c => ({ name: (c.name || '').trim(), distance_yards: Number(c.distance_yards) || 0 }))
      .filter(c => c.name.length > 0);
    if (cleaned.length === 0) {
      toast.error('Agregá al menos un palo');
      return;
    }
    setSaving(true);
    try {
      const r = await axios.put(`${API}/profile/clubs`, { clubs: cleaned });
      setClubs(r.data.clubs);
      setDirty(false);
      toast.success('✓ Bolsa guardada');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <p className="text-[#6B6E66] text-sm animate-pulse">Cargando bolsa…</p>
    </div>;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto fade-in" data-testid="my-bag-page">
      <Button variant="ghost" className="mb-4 text-[#6B6E66]"
        onClick={() => navigate('/dashboard')} data-testid="my-bag-back-btn">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <Card className="border-[#E2E3DD] shadow-none mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
            🏌️ Mi Bolsa
          </CardTitle>
          <p className="text-xs text-[#6B6E66]">
            Distancia promedio en yardas con cada palo. Durante la ronda, te sugerimos el palo al ver la distancia al green.
          </p>
        </CardHeader>
      </Card>

      <Card className="border-[#E2E3DD] shadow-none">
        <CardContent className="p-2">
          <div className="divide-y divide-[#E2E3DD]">
            {clubs.map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-1" data-testid={`my-bag-row-${i}`}>
                <div className="flex flex-col">
                  <button className="text-[#6B6E66] hover:text-[#1B3C35] disabled:opacity-30 p-0.5"
                    onClick={() => moveClub(i, i - 1)} disabled={i === 0}
                    aria-label="Subir" data-testid={`my-bag-up-${i}`}>
                    <GripVertical className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  value={c.name}
                  onChange={e => updateClub(i, { name: e.target.value })}
                  placeholder="Palo (ej: 7i)"
                  className="h-10 flex-1 border-[#E2E3DD] font-medium"
                  maxLength={20}
                  data-testid={`my-bag-name-${i}`}
                />
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline"
                    className="h-10 w-10 border-[#E2E3DD] shrink-0"
                    onClick={() => bumpDistance(i, -5)}
                    data-testid={`my-bag-minus-${i}`}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="w-20 text-center">
                    <Input type="number" inputMode="numeric"
                      value={c.distance_yards || ''}
                      onChange={e => updateClub(i, { distance_yards: parseInt(e.target.value || '0', 10) })}
                      className="h-10 text-center text-lg font-bold text-[#1B3C35] tabular-nums border-[#E2E3DD]"
                      data-testid={`my-bag-dist-${i}`}
                    />
                    <span className="text-[10px] text-[#6B6E66] uppercase tracking-wider">yardas</span>
                  </div>
                  <Button size="icon" variant="outline"
                    className="h-10 w-10 border-[#E2E3DD] shrink-0"
                    onClick={() => bumpDistance(i, 5)}
                    data-testid={`my-bag-plus-${i}`}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button size="icon" variant="ghost"
                  className="h-10 w-10 text-[#C96A52] hover:bg-[#C96A52]/10 shrink-0"
                  onClick={() => removeClub(i)}
                  data-testid={`my-bag-delete-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline"
            className="w-full mt-3 border-dashed border-[#C96A52]/40 text-[#C96A52] hover:bg-[#C96A52]/5"
            onClick={addClub}
            data-testid="my-bag-add-btn">
            <Plus className="h-4 w-4 mr-1" /> Agregar palo
          </Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 mt-4 flex justify-end">
        <Button
          className="bg-[#1B3C35] hover:bg-[#1B3C35]/90 shadow-lg"
          onClick={save}
          disabled={saving || !dirty}
          data-testid="my-bag-save-btn">
          <Save className="h-4 w-4 mr-1" />
          {saving ? 'Guardando…' : dirty ? 'Guardar bolsa' : 'Guardado ✓'}
        </Button>
      </div>
    </div>
  );
}
