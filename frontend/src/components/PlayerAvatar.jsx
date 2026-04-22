// Reusable player avatar. Falls back to initials on a color derived
// from the player's name so guests without accounts still look distinct.
import { useState } from 'react';

const TILE_COLORS = [
  'bg-[#1B3C35]', 'bg-[#C96A52]', 'bg-[#4A5D23]',
  'bg-[#1D2D44]', 'bg-amber-700', 'bg-rose-700',
  'bg-indigo-700', 'bg-teal-700', 'bg-emerald-700',
];

function hashColor(name) {
  let h = 0;
  for (const c of (name || '?')) h = ((h << 5) - h) + c.charCodeAt(0);
  return TILE_COLORS[Math.abs(h) % TILE_COLORS.length];
}

function getInitials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const SIZES = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
};

export default function PlayerAvatar({ name, url, size = 'sm', className = '', ring = false }) {
  const [broken, setBroken] = useState(false);
  const initials = getInitials(name);
  const color = hashColor(name);
  const sizing = SIZES[size] || SIZES.sm;
  const ringCls = ring ? 'ring-2 ring-white' : '';

  if (url && !broken) {
    return (
      <img
        src={url}
        alt={name || 'player'}
        onError={() => setBroken(true)}
        className={`${sizing} ${ringCls} rounded-full object-cover border border-[#E2E3DD] shrink-0 ${className}`}
        data-testid="player-avatar-img"
      />
    );
  }

  return (
    <div
      className={`${sizing} ${ringCls} rounded-full ${color} text-white font-bold flex items-center justify-center shrink-0 ${className}`}
      data-testid="player-avatar-initials"
      aria-label={name}
    >
      {initials}
    </div>
  );
}
