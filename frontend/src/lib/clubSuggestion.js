// Club suggestion helper: picks comfortable club(s) for a target yardage.
// Returns a human-readable suggestion object.
//
//   comfortable: clubs whose distance is within ±10% of target
//   Case A — 0 comfortable: forced pick (closest by absolute diff), flag forced=true
//   Case B — 1 comfortable: single suggestion, label "cómodo"
//   Case C — 2+ comfortable: show shorter (tailwind / viento a favor) and
//           longer (headwind / viento en contra) options.
//
// Distances assumed in the same unit (yards). "clubs" is [{name, distance_yards}].

export function suggestClub(targetYards, clubs) {
  if (!targetYards || !Array.isArray(clubs) || clubs.length === 0) return null;
  const usable = clubs.filter(c => Number(c.distance_yards) > 0);
  if (usable.length === 0) return null;

  const comfortable = usable.filter(c => {
    const d = Number(c.distance_yards);
    return targetYards >= d * 0.9 && targetYards <= d * 1.1;
  });

  if (comfortable.length === 0) {
    // Forced pick — nothing lands in comfort zone
    let best = usable[0];
    let bestDiff = Math.abs(best.distance_yards - targetYards);
    for (const c of usable) {
      const diff = Math.abs(c.distance_yards - targetYards);
      if (diff < bestDiff) { best = c; bestDiff = diff; }
    }
    return { mode: 'forced', pick: best };
  }

  if (comfortable.length === 1) {
    return { mode: 'single', pick: comfortable[0] };
  }

  // 2+ options — sort by distance ascending
  const sorted = [...comfortable].sort((a, b) => a.distance_yards - b.distance_yards);
  return {
    mode: 'range',
    shorter: sorted[0],                  // viento a favor (tailwind helps)
    longer:  sorted[sorted.length - 1],  // viento en contra (headwind)
  };
}
