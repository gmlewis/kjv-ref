import { describe, it, expect } from 'vitest';
import { computeGameLayout, FALLBACK_TOP_OVERLAY_PX } from './layout';

/**
 * The engine module that consumes this arithmetic cannot be unit tested — it
 * needs WebGPU, so it cannot run in jsdom — which makes this the only place the
 * vertical stack is pinned. Every assertion below is a relationship between two
 * bands, because the defect this module exists to fix was precisely a
 * *relationship* failure: the stats line and the verse sharing a band.
 */

/** The viewports this is actually run at: three phones and a desktop. */
const VIEWPORTS = [
  { name: 'small phone', W: 360, H: 640 },
  { name: 'mid phone', W: 384, H: 832 },
  { name: 'Pixel 10 XL', W: 412, H: 917 },
  { name: 'desktop', W: 1280, H: 800 },
] as const;

describe('computeGameLayout', () => {
  it('reproduces the historical fallback stack exactly', () => {
    // The extraction out of LampGame.ts must not have moved anything. These are
    // the values the engine computed with its hardcoded `domStageBottom = 88`
    // on the user's phone (412 CSS px wide at DPR 2.6214), and the plan's
    // "first verse row at 156".
    const l = computeGameLayout(412, 917);
    expect(l.isMobile).toBe(true);
    expect(l.isTiny).toBe(false);
    expect(l.chromeBottom).toBe(88);
    expect(l.hudY).toBe(132);
    expect(l.slotAreaTop).toBe(156);
    expect(l.pathY).toBe(833);
    expect(l.cellH).toBe(36);
    expect(l.margin).toBe(12);
  });

  it('keeps the stack in order at every viewport', () => {
    for (const { name, W, H } of VIEWPORTS) {
      // A realistic measured chrome height: the mode chips, the controls HUD
      // and the prompt column.
      for (const inset of [0, 88, 120, 180]) {
        const l = computeGameLayout(W, H, inset);
        const at = `${name} ${W}x${H} inset=${inset}`;

        // The DOM owns the top band; nothing in the canvas may start above it.
        // A real measurement is honoured exactly; an absent one (inset 0) falls
        // back, and the fallback is at least the smaller of the two constants.
        if (inset > 0) expect(l.chromeBottom, at).toBe(inset);
        expect(l.chromeBottom, at).toBeGreaterThanOrEqual(FALLBACK_TOP_OVERLAY_PX.desktop);

        // The three bands, top to bottom, with no overlap. The stats line must
        // clear the slot area by a real gap — this is the invariant that the
        // hardcoded guess used to violate.
        expect(l.headerY, at).toBeLessThan(l.hudTextTop);
        expect(l.hudTextTop, at).toBeLessThan(l.hudTextBottom);
        expect(l.hudTextBottom + 2, at).toBeLessThanOrEqual(l.slotAreaTop);

        // …and the whole stack is above the causeway the lamps stand on.
        expect(l.slotAreaTop, at).toBeLessThan(l.pathY);
        expect(l.pathY, at).toBeLessThan(H);
        expect(l.slotAreaTop, at).toBeGreaterThan(0);
      }
    }
  });

  it('moves the verse down when the DOM chrome is taller than the old guess', () => {
    // The actual bug: the canvas assumed 88 px of chrome. When the DOM band is
    // taller than that, the first verse row lands underneath it. The slot area
    // has to follow the measurement.
    const guess = computeGameLayout(412, 917, FALLBACK_TOP_OVERLAY_PX.mobile);
    const measured = computeGameLayout(412, 917, 150);
    expect(measured.slotAreaTop).toBeGreaterThan(guess.slotAreaTop);
    expect(measured.slotAreaTop - guess.slotAreaTop).toBe(150 - 88);
    // The causeway is anchored to the canvas bottom, so it does not move.
    expect(measured.pathY).toBe(guess.pathY);
  });

  it('is monotone: a taller inset never moves a band up', () => {
    for (const { name, W, H } of VIEWPORTS) {
      let prev = computeGameLayout(W, H, 1);
      for (const inset of [40, 90, 140, 200]) {
        const next = computeGameLayout(W, H, inset);
        const at = `${name} ${W}x${H} inset=${inset}`;
        expect(next.chromeBottom, at).toBeGreaterThanOrEqual(prev.chromeBottom);
        expect(next.hudY, at).toBeGreaterThanOrEqual(prev.hudY);
        expect(next.slotAreaTop, at).toBeGreaterThanOrEqual(prev.slotAreaTop);
        expect(next.pathY, at).toBe(prev.pathY);
        expect(next.hudFont, at).toBe(prev.hudFont);
        prev = next;
      }
    }
  });

  it('caps an absurd measurement instead of pushing the verse onto the lamps', () => {
    // The inset comes from the DOM, so it is not trusted blindly: an over-tall
    // reading must not be able to put the slot area below the causeway.
    const l = computeGameLayout(412, 917, 3000);
    expect(l.chromeBottom).toBeLessThanOrEqual(917 * 0.45);
    expect(l.slotAreaTop).toBeLessThan(l.pathY);

    // The cap is inert at any real measurement.
    for (const inset of [60, 100, 140, 200]) {
      expect(computeGameLayout(412, 917, inset).chromeBottom).toBe(inset);
    }
  });

  it('falls back rather than collapsing when no measurement has arrived', () => {
    // Boot lays out before the host's ResizeObserver has reported anything, and
    // a bogus reading must not be taken as "the chrome is zero pixels tall".
    const fallback = computeGameLayout(412, 917, 0);
    const negative = computeGameLayout(412, 917, -50);
    const expected = computeGameLayout(412, 917, FALLBACK_TOP_OVERLAY_PX.mobile);
    expect(fallback).toEqual(expected);
    expect(negative).toEqual(expected);
    expect(fallback.chromeBottom).toBeGreaterThan(0);
  });

  it('reports a wider chrome allowance on desktop than on a phone', () => {
    expect(FALLBACK_TOP_OVERLAY_PX.desktop).toBeLessThan(FALLBACK_TOP_OVERLAY_PX.mobile);
    expect(computeGameLayout(1280, 800).isMobile).toBe(false);
    expect(computeGameLayout(412, 917).isMobile).toBe(true);
    // A short viewport is mobile even when it is wide — landscape phones.
    expect(computeGameLayout(900, 500).isMobile).toBe(true);
    expect(computeGameLayout(900, 500).isTiny).toBe(true);
  });

  it('returns finite, positive geometry for every viewport', () => {
    for (const { name, W, H } of VIEWPORTS) {
      const l = computeGameLayout(W, H);
      for (const [key, value] of Object.entries(l)) {
        if (typeof value !== 'number') continue;
        expect(Number.isFinite(value), `${name}.${key}`).toBe(true);
        expect(value, `${name}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});
