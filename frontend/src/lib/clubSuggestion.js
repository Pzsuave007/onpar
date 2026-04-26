// Caddie — picks the right club for a target yardage, adjusting each club's
// "comfortable distance" for altitude, temperature AND wind.
//
// Physics rules of thumb:
//   • altitude  — thinner air = more carry. ~+2% per 1,000 ft.
//   • temperature — warmer air is less dense + ball is more elastic.
//                   ~+2 yards per +10 °F vs 70 °F baseline.
//   • wind — the component along the shot line:
//                   headwind costs ~1.0 y per mph
//                   tailwind gains ~0.5 y per mph
//                   pure crosswind doesn't change distance (only direction).
//
// Inputs:
//   targetYards    — distance to pin (yards)
//   clubs          — [{ name, distance_yards }] from My Bag
//   options        — {
//     calibration  : { altitude_ft, temp_f },               // where bag was measured
//     conditions   : { altitude_ft, temp_f, wind_mph, wind_dir },
//     shot_bearing : 0..360 (degrees, compass) — direction the ball is going
//   }
//
// Output:
//   { mode, pick / shorter / longer,
//     breakdown: {altitude_y, temp_y, wind_y, wind_label, total_delta_y} }

const ALT_PCT_PER_FT  = 0.02 / 1000;   // +2% per 1000 ft
const TEMP_Y_PER_F    = 0.2 / 1;       // +2 yards per 10 °F
const HEAD_Y_PER_MPH  = 1.0;
const TAIL_Y_PER_MPH  = 0.5;
const BASE_TEMP_F     = 70;
const COMFORT_PCT     = 0.10;          // ±10 % of effective distance

function altFactor(ft)  { return 1 + (ft || 0) * ALT_PCT_PER_FT; }
function tempAdj(temp_f) { return ((temp_f ?? BASE_TEMP_F) - BASE_TEMP_F) * TEMP_Y_PER_F; }

/**
 * Component of wind along the shot line:
 *   tail (+, gain), head (-, loss).
 * wind_from_deg follows meteorological convention (where the wind is coming FROM).
 * shot_to_deg is the bearing the ball is travelling TOWARD.
 */
function windYardageEffect(wind_mph, wind_from_deg, shot_to_deg) {
  if (!wind_mph || wind_from_deg == null || shot_to_deg == null) {
    return { y: 0, label: '', kind: 'none' };
  }
  const wind_to = (wind_from_deg + 180) % 360;
  let angle = Math.abs(shot_to_deg - wind_to);
  if (angle > 180) angle = 360 - angle;
  const component = wind_mph * Math.cos((angle * Math.PI) / 180);
  // If the along-shot component is < half the total wind speed, it's
  // effectively crosswind — ignore distance impact and just label it.
  const isCross = Math.abs(component) < wind_mph * 0.5;
  if (isCross) {
    return { y: 0, label: `${Math.round(wind_mph)} mph crosswind`, kind: 'cross' };
  }
  if (component >= 0) {
    const y = Math.round(component * TAIL_Y_PER_MPH);
    return { y, label: y >= 2 ? `+${y}y tailwind` : '', kind: 'tail' };
  }
  const y = Math.round(component * HEAD_Y_PER_MPH);
  return { y, label: y <= -2 ? `${y}y headwind` : '', kind: 'head' };
}

/**
 * For one club: given the distance the user MEASURED in their home conditions,
 * back out a "true sea-level/70°F base" and re-apply current conditions to get
 * the effective distance the ball will actually carry today.
 */
function effectiveYards(measured, calibration, conditions, windY) {
  if (!measured) return 0;
  const calAltFactor = altFactor(calibration?.altitude_ft);
  const calTempAdj   = tempAdj(calibration?.temp_f);
  const trueBase     = (Number(measured) - calTempAdj) / calAltFactor;
  const curAltFactor = altFactor(conditions?.altitude_ft);
  const curTempAdj   = tempAdj(conditions?.temp_f);
  return trueBase * curAltFactor + curTempAdj + (windY || 0);
}

export function suggestClub(targetYards, clubs, options = {}) {
  if (!targetYards || !Array.isArray(clubs) || clubs.length === 0) return null;

  const wind = windYardageEffect(
    options.conditions?.wind_mph,
    options.conditions?.wind_dir,
    options.shot_bearing
  );

  const usable = clubs
    .filter(c => Number(c.distance_yards) > 0)
    .map(c => ({
      name: c.name,
      measured_yards: Number(c.distance_yards),
      effective_yards: Math.round(effectiveYards(c.distance_yards, options.calibration, options.conditions, wind.y)),
    }));
  if (usable.length === 0) return null;

  const inComfort = (eff) =>
    targetYards >= eff * (1 - COMFORT_PCT) && targetYards <= eff * (1 + COMFORT_PCT);
  const comfortable = usable.filter(c => inComfort(c.effective_yards));

  // Compute breakdown for the closest-by-effective club so we can show
  // "+5y altitude · -4y heat · -8y headwind" hints in the UI.
  const closest = [...usable].sort(
    (a, b) => Math.abs(a.effective_yards - targetYards) - Math.abs(b.effective_yards - targetYards)
  )[0];
  const totalDelta = (closest?.effective_yards ?? 0) - (closest?.measured_yards ?? 0);

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
    wind_y: wind.y,
    wind_label: wind.label,
    wind_kind: wind.kind,
    total_delta_y: Math.round(totalDelta),
  };

  if (comfortable.length === 0) {
    return { mode: 'forced', pick: closest, breakdown };
  }
  if (comfortable.length === 1) {
    return { mode: 'single', pick: comfortable[0], breakdown };
  }
  const sorted = [...comfortable].sort((a, b) => a.effective_yards - b.effective_yards);
  return {
    mode: 'range',
    shorter: sorted[0],
    longer:  sorted[sorted.length - 1],
    breakdown,
  };
}
