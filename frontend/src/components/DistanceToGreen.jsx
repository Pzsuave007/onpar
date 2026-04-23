// Crowd-sourced GPS yardage to green.
// - If hole has pinned coords → show live distance using navigator.geolocation
// - If not → show "Pin Green" button (for when player is standing on the green)
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Flag, Crosshair } from 'lucide-react';

// Haversine distance in meters
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function DistanceToGreen({ courseId, hole, onPinned }) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState(null);
  const [pinning, setPinning] = useState(false);
  const watchId = useRef(null);

  const pinned = hole?.green_lat && hole?.green_lng;

  useEffect(() => {
    if (!navigator.geolocation) { setError('no-gps'); return; }
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      (err) => setError(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const handlePin = async () => {
    if (!pos) { toast.error('Esperando ubicación GPS…'); return; }
    setPinning(true);
    try {
      await axios.put(`${API}/courses/${courseId}/holes/${hole.hole}/green-pin`,
        { lat: pos.lat, lng: pos.lng });
      toast.success('✓ Green pinneado — siguientes jugadores verán la distancia');
      onPinned && onPinned({ hole_num: hole.hole, lat: pos.lat, lng: pos.lng });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al pinnear');
    } finally { setPinning(false); }
  };

  if (error === 'no-gps') {
    return <p className="text-[10px] text-[#6B6E66] text-center">GPS no disponible</p>;
  }
  if (error === 'denied') {
    return <p className="text-[10px] text-[#6B6E66] text-center">
      Activa ubicación para ver distancia al green
    </p>;
  }
  if (!pos) {
    return (
      <p className="text-[10px] text-[#6B6E66] text-center flex items-center justify-center gap-1">
        <Crosshair className="h-3 w-3 animate-pulse" /> Obteniendo GPS…
      </p>
    );
  }

  if (!pinned) {
    return (
      <button
        onClick={handlePin}
        disabled={pinning}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#C96A52]/10 border border-dashed border-[#C96A52]/40 hover:bg-[#C96A52]/20 transition-colors"
        data-testid={`pin-green-${hole.hole}`}>
        <Flag className="h-3.5 w-3.5 text-[#C96A52]" />
        <span className="text-xs font-bold text-[#C96A52]">
          {pinning ? 'Guardando…' : '¿En el green? Pinealo'}
        </span>
      </button>
    );
  }

  const meters = distanceMeters(pos.lat, pos.lng, hole.green_lat, hole.green_lng);
  const yards = Math.round(meters * 1.09361);
  return (
    <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-[#1B3C35] text-white"
      data-testid={`distance-${hole.hole}`}>
      <Flag className="h-4 w-4 text-[#C96A52]" />
      <span className="text-xs uppercase tracking-wider font-bold opacity-75">To Green</span>
      <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'Outfit' }}>
        {yards}y
      </span>
      <span className="text-[10px] opacity-60">±{Math.round(pos.acc)}m</span>
    </div>
  );
}
