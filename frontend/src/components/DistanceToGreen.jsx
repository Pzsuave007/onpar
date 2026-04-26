// Crowd-sourced GPS yardage to green + Caddie club suggestion from the user's bag.
// - If hole has pinned coords → show live distance using navigator.geolocation
//   AND a Caddie suggestion adjusted for current altitude + temperature.
// - If not → show "Pin Green" button (when player is standing on the green).
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Flag, Crosshair } from 'lucide-react';
import { suggestClub } from '@/lib/clubSuggestion';
import { fetchConditions } from '@/lib/conditions';

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
  const [clubs, setClubs] = useState([]);
  const [calibration, setCalibration] = useState({ altitude_ft: 0, temp_f: 70 });
  const [conditions, setConditions] = useState(null);
  const watchId = useRef(null);

  const pinned = hole?.green_lat && hole?.green_lng;

  // Load the user's bag + calibration once.
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/profile/clubs`).then(r => {
      if (cancelled) return;
      setClubs(r.data?.clubs || []);
      if (r.data?.bag_calibration) setCalibration(r.data.bag_calibration);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Pull current conditions for the green's coordinates (cached 30 min).
  useEffect(() => {
    if (!pinned) return;
    let cancelled = false;
    fetchConditions(hole.green_lat, hole.green_lng).then(c => {
      if (!cancelled) setConditions(c);
    });
    return () => { cancelled = true; };
  }, [pinned, hole?.green_lat, hole?.green_lng]);

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
    if (!pos) { toast.error('Waiting for GPS…'); return; }
    setPinning(true);
    try {
      await axios.put(`${API}/courses/${courseId}/holes/${hole.hole}/green-pin`,
        { lat: pos.lat, lng: pos.lng, accuracy: pos.acc });
      toast.success('✓ Green pinned — next players will see the distance');
      onPinned && onPinned({ hole_num: hole.hole, lat: pos.lat, lng: pos.lng });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Pin failed');
    } finally { setPinning(false); }
  };

  if (error === 'no-gps') {
    return <p className="text-[10px] text-[#6B6E66] text-center">GPS not available</p>;
  }
  if (error === 'denied') {
    return <p className="text-[10px] text-[#6B6E66] text-center">
      Enable location to see distance to green
    </p>;
  }
  if (!pos) {
    return (
      <p className="text-[10px] text-[#6B6E66] text-center flex items-center justify-center gap-1">
        <Crosshair className="h-3 w-3 animate-pulse" /> Locking GPS…
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
          {pinning ? 'Saving…' : 'On the green? Pin it'}
        </span>
      </button>
    );
  }

  const meters = distanceMeters(pos.lat, pos.lng, hole.green_lat, hole.green_lng);
  const yards = Math.round(meters * 1.09361);
  const suggestion = suggestClub(yards, clubs, { calibration, conditions });

  // Build the small "+5y altitude · -4y heat" line shown under the pick.
  const breakdown = suggestion?.breakdown;
  const breakdownLabel = breakdown && (Math.abs(breakdown.altitude_y) >= 2 || Math.abs(breakdown.temp_y) >= 2)
    ? [
        breakdown.altitude_y >= 2 ? `+${breakdown.altitude_y}y altitude`
          : breakdown.altitude_y <= -2 ? `${breakdown.altitude_y}y altitude` : null,
        breakdown.temp_y >= 2 ? `+${breakdown.temp_y}y heat`
          : breakdown.temp_y <= -2 ? `${breakdown.temp_y}y cold` : null,
      ].filter(Boolean).join(' · ')
    : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-[#1B3C35] text-white"
        data-testid={`distance-${hole.hole}`}>
        <Flag className="h-4 w-4 text-[#C96A52]" />
        <span className="text-xs uppercase tracking-wider font-bold opacity-75">To Green</span>
        <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'Outfit' }}>
          {yards}y
        </span>
        <span className="text-[10px] opacity-60">±{Math.round(pos.acc)}m</span>
      </div>
      {suggestion && (
        <div className="py-2 px-3 rounded-lg bg-[#F4E9D8]/60 border border-[#C96A52]/20 text-center"
          data-testid={`caddie-${hole.hole}`}>
          <div className="text-xs text-[#6B6E66] uppercase tracking-wider font-bold mb-1 flex items-center justify-center gap-1">
            <span>🧢</span> Caddie says
          </div>
          {suggestion.mode === 'single' && (
            <div>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-3xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                  {suggestion.pick.name}
                </span>
                <span className="text-base text-[#6B6E66] tabular-nums">
                  plays {suggestion.pick.effective_yards}y
                </span>
              </div>
              {breakdownLabel && (
                <div className="text-[10px] text-[#6B6E66] mt-0.5">{breakdownLabel}</div>
              )}
            </div>
          )}
          {suggestion.mode === 'range' && (
            <div>
              <div className="flex items-stretch justify-center gap-3 text-center">
                <div className="flex-1">
                  <div className="text-3xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                    {suggestion.shorter.name}
                  </div>
                  <div className="text-sm text-[#6B6E66]">
                    plays {suggestion.shorter.effective_yards}y
                  </div>
                </div>
                <div className="text-[#C96A52] self-center text-base font-bold">or</div>
                <div className="flex-1">
                  <div className="text-3xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                    {suggestion.longer.name}
                  </div>
                  <div className="text-sm text-[#6B6E66]">
                    plays {suggestion.longer.effective_yards}y
                  </div>
                </div>
              </div>
              {breakdownLabel && (
                <div className="text-[10px] text-[#6B6E66] mt-1">{breakdownLabel}</div>
              )}
            </div>
          )}
          {suggestion.mode === 'forced' && (
            <div>
              <span className="text-3xl font-bold text-[#1B3C35]" style={{ fontFamily: 'Outfit' }}>
                {suggestion.pick.name}
              </span>
              <div className="text-sm text-[#6B6E66] mt-0.5">
                Out of range · {suggestion.pick.effective_yards}y max
              </div>
              {breakdownLabel && (
                <div className="text-[10px] text-[#6B6E66] mt-0.5">{breakdownLabel}</div>
              )}
            </div>
          )}
        </div>
      )}
      {!suggestion && clubs.length === 0 && (
        <a href="/my-bag" className="text-xs text-[#C96A52] hover:underline block text-center py-1"
          data-testid={`setup-bag-link-${hole.hole}`}>
          Set up your bag to see Caddie suggestions →
        </a>
      )}
    </div>
  );
}
