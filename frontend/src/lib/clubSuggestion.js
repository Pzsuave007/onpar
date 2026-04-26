// Caddie — picks the right club for a target yardage, adjusting each club's
// "comfortable distance" for altitude and temperature differences between
// where the user CALIBRATED their bag (typically their home course / where
// they measured their normal distances) and CURRENT on-course conditions.
//
// Physics rules of thumb:
//   • altitude — thinner air = more carry. ~+2% per 1,000 ft.
//   • temperature — warmer air is less dense + ball is more elastic.
//                   ~+2 yards per +10 °F vs 70 °F baseline.
// (Wind is shown as a label hint; we still pick "shorter / longer" within the
//  ±10 % comfort band so the player can step up/down with the wind.)
//
// Inputs:
//   targetYards    — distance to pin (yards)
//   clubs          — [{ name, distance_yards }] from My Bag
//   options        — {
//     calibration : { altitude_ft, temp_f },     // where bag was measured
//     conditions  : { altitude_ft, temp_f, wind_mph },
//   }
//
// Output:
//   { mode, pick / shorter / longer, breakdown: {altitude_y, temp_y, total_delta_y} }

const ALT_PCT_PER_FT = 0.02 / 1000;   // +2% per 1000 ft
const TEMP_Y_PER_F   = 0.2 / 1;       // +2 yards per 10 °F
const BASE_TEMP_F    = 70;
const COMFORT_PCT    = 0.10;          // ±10 % of effective distance

function altFactor(ft)  { return 1 + (ft || 0) * ALT_PCT_PER_FT; }
function tempAdj(temp_f) { return ((temp_f ?? BASE_TEMP_F) - BASE_TEMP_F) * TEMP_Y_PER_F; }

/**
 * For one club: given the distance the user MEASURED in their home conditions,
 * back out a "true sea-level/70°F base" and re-apply current conditions to get
 * the effective distance the ball will actually carry today.
 */
function effectiveYards(measured, calibration, conditions) {
  if (!measured) return 0;
  const calAltFactor = altFactor(calibration?.altitude_ft);
  const calTempAdj   = tempAdj(calibration?.temp_f);
  const trueBase     = (Number(measured) - calTempAdj) / calAltFactor;
  const curAltFactor = altFactor(conditions?.altitude_ft);
  const curTempAdj   = tempAdj(conditions?.temp_f);
  return trueBase * curAltFactor + curTempAdj;
}

export function suggestClub(targetYards, clubs, options = {}) {
  if (!targetYards || !Array.isArray(clubs) || clubs.length === 0) return null;
  const usable = clubs
    .filter(c => Number(c.distance_yards) > 0)
    .map(c => ({
      name: c.name,
      measured_yards: Number(c.distance_yards),
      effective_yards: Math.round(effectiveYards(c.distance_yards, options.calibration, options.conditions)),
    }));
  if (usable.length === 0) return null;

  const inComfort = (eff) =>
    targetYards >= eff * (1 - COMFORT_PCT) && targetYards <= eff * (1 + COMFORT_PCT);
  const comfortable = usable.filter(c => inComfort(c.effective_yards));

  // Compute breakdown for the closest-by-effective club so we can show
  // "+5y altitude · -4y heat" hints in the UI.
  const closest = [...usable].sort(
    (a, b) => Math.abs(a.effective_yards - targetYards) - Math.abs(b.effective_yards - targetYards)
  )[0];
  const totalDelta = (closest?.effective_yards ?? 0) - (closest?.measured_yards ?? 0);

  // What share of that delta is altitude vs temperature? Recompute deltas
  // explicitly so the UI can label them.
  let altDelta = 0, tempDelta = 0;
  if (closest) {
    const calA = altFactor(options.calibration?.altitude_ft);
    const calT = tempAdj(options.calibration?.temp_f);
    const trueBase = (closest.measured_yards - calT) / calA;
    const curA = altFactor(options.conditions?.altitude_ft);
    altDelta  = Math.round(trueBase * curA - trueBase * calA);
    tempDelta = Math.round(tempAdj(options.conditions?.temp_f) - calT);
  }
  const breakdown = {
    altitude_y: altDelta,
    temp_y: tempDelta,
    total_delta_y: Math.round(totalDelta),
  };

  if (comfortable.length === 0) {
    return { mode: 'forced', pick: closest, breakdown };
  }
  if (comfortable.length === 1) {
    return { mode: 'single', pick: comfortable[0], breakdown };
  }
  // 2+ comfortable clubs — show shorter (with wind) and longer (into wind).
  const sorted = [...comfortable].sort((a, b) => a.effective_yards - b.effective_yards);
  return {
    mode: 'range',
    shorter: sorted[0],
    longer:  sorted[sorted.length - 1],
    breakdown,
  };
}
