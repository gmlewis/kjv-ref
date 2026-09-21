import { describe, it, expect } from 'vitest';
import {
  AMBIENT_IDLE_MS,
  AMBIENT_INTERVAL_MS,
  WAKE_MS,
  ambientActive,
  shouldKeepRendering,
} from './idle';

/**
 * The scene is rendered at native phone density, so every frame it does not draw
 * is the whole point of the idling work. These pin the three decisions that make
 * it safe: a mutation always gets frames, the ambient pulse gives up on its own,
 * and reduced motion never animates ambiently at all.
 */

const base = {
  panning: false,
  particles: 0,
  ambientSprites: 36, // 12 flames + 12 beams + 12 reflections, the live-scene case
  reducedMotion: false,
  lastActivityAt: 1000,
};

describe('shouldKeepRendering', () => {
  it('keeps rendering for a window after anything changed, then stops', () => {
    expect(shouldKeepRendering({ ...base, now: 1000 })).toBe(true);
    expect(shouldKeepRendering({ ...base, now: 1000 + WAKE_MS - 1 })).toBe(true);
    // Past the window the ambient pulse is still running, so it does not stop yet…
    expect(shouldKeepRendering({ ...base, now: 1000 + WAKE_MS })).toBe(true);
    // …but only until the ambient idle timeout.
    expect(shouldKeepRendering({ ...base, now: 1000 + AMBIENT_IDLE_MS })).toBe(false);
  });

  it('stops when there is nothing ambient to animate, even mid-window', () => {
    // The summary screen and "No verses available": teardownPuzzle has removed the
    // flames, beams and reflections, so the scene is static text and scenery.
    const terminal = { ...base, ambientSprites: 0 };
    expect(shouldKeepRendering({ ...terminal, now: 1000 + WAKE_MS })).toBe(false);
    // Still true inside the wake window — the frame that draws the summary text
    // must happen.
    expect(shouldKeepRendering({ ...terminal, now: 1000 + WAKE_MS - 1 })).toBe(true);
  });

  it('never idles mid-animation', () => {
    const late = 1000 + AMBIENT_IDLE_MS + 10_000;
    expect(shouldKeepRendering({ ...base, now: late, panning: true })).toBe(true);
    expect(shouldKeepRendering({ ...base, now: late, particles: 3 })).toBe(true);
    // A particle burst with no ambient sprites (the celebration) is the same story.
    expect(shouldKeepRendering({ ...base, ambientSprites: 0, now: late, particles: 1 })).toBe(true);
  });

  it('freezes ambient animation outright under reduced motion', () => {
    const reduced = { ...base, reducedMotion: true };
    // Sprites exist and the player is active, and it still does not animate.
    expect(ambientActive({ ...reduced, now: 1000 })).toBe(false);
    expect(shouldKeepRendering({ ...reduced, now: 1000 + WAKE_MS })).toBe(false);
    // Input still gets its frames — the game stays playable, it just holds still.
    expect(shouldKeepRendering({ ...reduced, now: 1000 + WAKE_MS - 1 })).toBe(true);
  });

  it('the ambient pulse is a genuinely slower cadence than the wake window', () => {
    // A cadence at or above 60fps would leave the throttle pointless, and an idle
    // timeout shorter than the wake window would make the two rules fight: the
    // wake path would keep re-arming a pulse that had just decided to stop.
    expect(AMBIENT_INTERVAL_MS).toBeGreaterThan(1000 / 60);
    expect(AMBIENT_IDLE_MS).toBeGreaterThan(WAKE_MS * 10);
  });
});
