// Tiny wrappers around canvas-confetti for birdie/eagle/HIO celebrations.
// Visual only, no sound (respectful for on-course / public use).
import confetti from 'canvas-confetti';

const PALETTE = ['#C96A52', '#F4E9D8', '#1B3C35', '#4A5D23'];

export function birdieConfetti() {
  confetti({
    particleCount: 60,
    spread: 55,
    origin: { y: 0.7 },
    colors: PALETTE,
    scalar: 0.8,
  });
}

export function eagleConfetti() {
  // Twin cannons for eagle
  const end = Date.now() + 700;
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: PALETTE });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: PALETTE });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export function holeInOneConfetti() {
  // Full-screen, multi-burst for HIO
  const burst = (ratio) => confetti({
    particleCount: Math.floor(200 * ratio),
    spread: 360,
    startVelocity: 45,
    origin: { y: 0.5 },
    colors: PALETTE,
    scalar: 1.1,
  });
  burst(0.3);
  setTimeout(() => burst(0.4), 200);
  setTimeout(() => burst(0.3), 400);
}

/**
 * Trigger the right animation given par and strokes (counts only improvements).
 * Returns the label used, or null if no celebration.
 */
export function celebrateScore(par, strokes) {
  if (!par || !strokes) return null;
  const diff = strokes - par;
  if (strokes === 1) { holeInOneConfetti(); return 'hole-in-one'; }
  if (diff <= -2)    { eagleConfetti();      return 'eagle+'; }
  if (diff === -1)   { birdieConfetti();     return 'birdie'; }
  return null;
}
