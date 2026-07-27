// Fluency-timer logic for the "Lamp of the Path" game.
//
// The fluency timer rewards *fast, automatic* recall: a gentle ring depletes
// around the active lighthouse over ~N seconds (scaled by verse length), and
// finishing before it empties earns a "Fluent" bonus (+50% XP, brighter flare,
// combo visual escalation). Running out does not fail — the ring just fades.
//
// This module is pure: it computes duration, elapsed, depletion fraction, and
// the fluent flag from a target word count + timestamps. The engine polls
// `depletionFraction` each frame and calls `isFluentNow` at resolve time.

/** Convert a verse word count to the fluency timer duration in milliseconds.
 *
 *  Baseline: 20 s for a 10-word verse, scaling linearly to 40 s at 30+ words.
 *  Very short verses stay snappy; long verses relax proportionally.
 *  Returns milliseconds (always ≥ 5000 to avoid degenerate cases).
 */
export function fluencyDurationMs(wordCount: number): number {
  const w = Math.max(1, Math.min(wordCount, 40));
  // Linear ramp from 20s (10 words) to 40s (30 words).
  // For word counts below 10, duration scales down proportionally,
  // floored at 5s so even short verses feel responsive.
  // For word counts above 30, duration is clamped at 40s.
  let ms: number;
  if (w <= 10) {
    // Scale from 5s (1 word) to 20s (10 words): 15000ms / 9 words ≈ 1666.67ms per word
    ms = 5000 + Math.round((w - 1) * 15000 / 9);
  } else if (w <= 30) {
    ms = 20000 + (w - 10) * 1000;
  } else {
    ms = 40000;
  }
  return Math.max(5000, Math.min(40000, ms));
}

/** Return the depletion fraction [0..1] where 1 = fresh, 0 = exhausted. */
export function depletionFraction(startMs: number, nowMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const elapsed = Math.max(0, nowMs - startMs);
  const remaining = Math.max(0, durationMs - elapsed);
  return remaining / durationMs;
}

/** Whether a resolve at `nowMs` (with puzzle start at `startMs`) counts as "fluent". */
export function isFluentNow(startMs: number, nowMs: number, durationMs: number): boolean {
  return depletionFraction(startMs, nowMs, durationMs) > 0;
}

/** Map a depletion fraction to a visual ring opacity (fade out near the end). */
export function ringOpacityFor(fraction: number): number {
  // Full opacity until 25% remaining, then ease to transparent over the last 25%.
  if (fraction >= 0.25) return 1;
  return Math.max(0, fraction / 0.25);
}

/** Pulse scale (1.0 = base) for the ring at a given fraction: slight breathing. */
export function ringPulseScale(fraction: number, timeMs: number): number {
  // Subtle 4Hz breathing while active, frozen at scale 1 when past 25% depleted.
  const breath = Math.sin((timeMs / 1000) * Math.PI * 2 * 0.6) * 0.05;
  const depletionShrink = 1 - (1 - fraction) * 0.15; // shrink up to 15% as it depletes
  return Math.max(0.85, depletionShrink + breath);
}
