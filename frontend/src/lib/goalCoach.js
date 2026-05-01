// Goal Coach — turn a simple "Break 90" goal into live coaching.
//
// Used by PlayerDashboard (setup card), PlayRound (pace banner) and the
// Caddie (per-hole strategy tip).
//
// Key ideas:
//   • Pace is distributed evenly across 18 holes; a round of "goal 89" on a
//     par-72 course is 17 over par → an average of ~4.94 strokes per hole.
//   • "Expected after N holes" is that average × N, so we can compare to actual.
//   • Strategy tip depends on how many over-par strokes the goal allows.

const BASE_HOLES = 18;

/** Round down 0.5 up so "expected" never undershoots by a half-stroke. */
function roundHalfUp(n) { return Math.floor(n + 0.5); }

/** Handicap → sensible default goal. Used to pre-fill the goal card so the
 *  first-time setup is one click. */
export function suggestGoalForHandicap(hcp) {
  if (hcp == null) return 100;
  if (hcp >= 25) return 100;
  if (hcp >= 17) return 95;
  if (hcp >= 11) return 90;
  if (hcp >= 6)  return 85;
  if (hcp >= 2)  return 80;
  return 75;
}

/** Strategy message — 1 sentence for dashboard / banner. */
export function strategyMessage(targetScore, parBaseline = 72) {
  const overPar = targetScore - parBaseline;
  if (overPar >= 20) return 'Double bogey every hole is fine — focus on keeping the ball in play.';
  if (overPar >= 15) return 'Bogey target on each hole — any par builds cushion.';
  if (overPar >= 10) return 'Mostly bogeys — aim for par on the short holes.';
  if (overPar >= 5)  return 'Pars and bogeys mixed — avoid big numbers on par 5s.';
  if (overPar >= 0)  return 'Mostly pars with a few bogeys you can afford.';
  if (overPar >= -3) return 'Need a couple of birdies — attack the short par 4s.';
  return 'Tour-level round — birdies on every par 5, no dropped shots.';
}

/** Expected total strokes after `holesPlayed` holes at goal pace. */
export function expectedThruHoles(targetScore, holesPlayed) {
  if (!targetScore || !holesPlayed) return 0;
  return roundHalfUp((targetScore * holesPlayed) / BASE_HOLES);
}

/**
 * Given the goal and the holes a player has submitted so far, compute
 *    { expected, actual, delta, status, label, best_case, caption }
 * delta > 0 means BEHIND goal pace (bad). delta < 0 means AHEAD (good).
 */
export function computePace(targetScore, holes) {
  if (!targetScore || !Array.isArray(holes)) return null;
  const completed = holes.filter(h => Number(h?.strokes) > 0);
  const holesPlayed = completed.length;
  if (holesPlayed === 0) return null;

  const actual   = completed.reduce((s, h) => s + Number(h.strokes), 0);
  const expected = expectedThruHoles(targetScore, holesPlayed);
  const delta    = actual - expected;                         // + = behind, − = ahead
  const remaining = BASE_HOLES - holesPlayed;

  // Best case (all pars from here) using the pars that actually exist in the
  // full scorecard (falls back to par 4 if missing).
  const remainingPars = holes
    .slice(holesPlayed, BASE_HOLES)
    .map(h => Number(h?.par) || 4);
  const remPar = remainingPars.reduce((s, p) => s + p, 0);
  const bestCase = actual + remPar;                           // if you par out
  const budget   = targetScore - 1 - actual - remPar;         // over-par strokes allowed in remaining holes
                                                              // (negative = need to birdie; 0 = par out; N = N bogeys OK)

  const bogeysAllowed = Math.max(0, budget);
  const birdiesNeeded = Math.max(0, -budget);

  let status, label, caption;
  if (bestCase > targetScore - 1) {
    status  = 'unreachable';
    label   = `Goal out of reach`;
    caption = `Par-out finish = ${bestCase}. Reset goal or push for your best score.`;
  } else if (delta <= -2) {
    status  = 'ahead';
    label   = `${Math.abs(delta)} ahead of pace`;
    // Bogey budget capped at remaining holes (can't bogey more holes than exist).
    const bogeyCap = Math.min(bogeysAllowed, remaining);
    caption = bogeyCap >= remaining
      ? `Bogey every remaining hole and you still break ${targetScore}. Great round going.`
      : `You can bogey ${bogeyCap} of the last ${remaining} holes and still break ${targetScore}.`;
  } else if (delta <= 0) {
    status  = 'on-pace';
    label   = 'On pace';
    caption = bogeysAllowed > 0
      ? `${bogeysAllowed} bogey${bogeysAllowed === 1 ? '' : 's'} allowed in the last ${remaining} holes.`
      : `Par every remaining hole to break ${targetScore}.`;
  } else if (delta <= 2) {
    status  = 'behind';
    label   = `${delta} behind pace`;
    caption = birdiesNeeded > 0
      ? `Need ${birdiesNeeded} birdie${birdiesNeeded === 1 ? '' : 's'} or pars-only in ${remaining} holes.`
      : `${bogeysAllowed} bogey${bogeysAllowed === 1 ? '' : 's'} max in ${remaining} holes — par the next to get back.`;
  } else {
    status  = 'way-behind';
    label   = `${delta} behind — push`;
    caption = birdiesNeeded > 0
      ? `Need ${birdiesNeeded} birdie${birdiesNeeded === 1 ? '' : 's'} in ${remaining} holes and no more mistakes.`
      : `Only ${bogeysAllowed} bogey${bogeysAllowed === 1 ? '' : 's'} allowed in ${remaining} holes. Play aggressive but smart.`;
  }

  return {
    expected, actual, delta, status, label, caption,
    holes_played: holesPlayed, remaining, best_case: bestCase,
    bogeys_allowed: bogeysAllowed, birdies_needed: birdiesNeeded,
  };
}
