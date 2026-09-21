import { describe, it, expect } from 'vitest';
import { createGameSpriteFrames, TOWER_LANTERN_ABOVE_FOOT, TOWER_ASPECT } from './art';
import { SCENERY_BANDS, SCENERY_BAND_CSS_WIDTH } from './scenery';

/**
 * These are invariants of the painted atlas, not probes of specific pixels.
 *
 * The old version of this file asserted exact colours at exact coordinates of
 * the placeholder art (the waterfall's foam at (8,0), the citadel's emerald hill
 * at (4,63)). Every one of those coordinates is meaningless now that the art has
 * been repainted at device density and from different profiles, and a test that
 * has to be re-derived from the implementation is not testing anything. What
 * follows is what must stay true no matter how the art is painted: which frames
 * exist, that they are well-formed, and the handful of relationships the *engine*
 * depends on — because the engine reads art.ts's constants and the two can drift.
 */

const pixelAt = (frame: { width: number; pixels: Uint8Array }, x: number, y: number) => {
  const i = (y * frame.width + x) * 4;
  return {
    r: frame.pixels[i],
    g: frame.pixels[i + 1],
    b: frame.pixels[i + 2],
    a: frame.pixels[i + 3],
  };
};

/** Mean RGB of one frame row, over the pixels that are actually opaque. */
function rowMean(frame: { width: number; pixels: Uint8Array }, y: number) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let x = 0; x < frame.width; x++) {
    const p = pixelAt(frame, x, y);
    if (p.a === 0) continue;
    r += p.r; g += p.g; b += p.b; n++;
  }
  return n === 0 ? null : { r: r / n, g: g / n, b: b / n, n };
}

describe('createGameSpriteFrames', () => {
  it('returns the exact frame inventory the engine draws from', () => {
    const names = createGameSpriteFrames().map((f) => f.name);
    // The engine looks frames up by name and now throws on an unknown one, so
    // this list is the contract between the two files.
    expect(names).toEqual([
      'w',
      'sky',
      'scenery_far',
      'scenery_mid',
      'scenery_near',
      'lighthouse_unlit',
      'lighthouse_lit',
      'beacon_beam',
      'glow_halo',
      'fluency_ring',
      'flame',
      'lamp_shadow',
      'lamp_pool',
      'lamp_reflection',
      'tile_bg',
      'slot_bg',
    ]);
  });

  it('pins the 1x1 white pixel at index 0', () => {
    // Not cosmetic: the slot borders and the feedback pill are drawn as
    // `frame: 0` quads tinted by `color`, so index 0 must be opaque white.
    const [first] = createGameSpriteFrames();
    expect(first.name).toBe('w');
    expect(first.width).toBe(1);
    expect(first.height).toBe(1);
    expect([...first.pixels]).toEqual([255, 255, 255, 255]);
  });

  it('gives every frame a well-formed RGBA buffer', () => {
    for (const frame of createGameSpriteFrames()) {
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
      expect(frame.pixels).toBeInstanceOf(Uint8Array);
      expect(frame.pixels.length).toBe(frame.width * frame.height * 4);
    }
  });

  it('gives every drawn frame some opaque pixels', () => {
    // A frame that is entirely transparent renders as nothing at all, which is
    // how `beacon_beam` was silently invisible once (painted additively, so the
    // alpha channel was never written).
    for (const frame of createGameSpriteFrames()) {
      if (frame.name === 'w') continue;
      let opaque = 0;
      for (let i = 3; i < frame.pixels.length; i += 4) {
        if (frame.pixels[i] > 0) opaque++;
      }
      expect(opaque, `${frame.name} is fully transparent`).toBeGreaterThan(0);
    }
  });

  it('authors the scenery bands at one density on both axes', () => {
    // Each band's frame is stretched over an extent derived from SCENERY_BANDS.
    // If its two axes were authored at different densities the band would be
    // drawn squashed, which is invisible until you look at a phone.
    const frames = new Map(createGameSpriteFrames().map((f) => [f.name, f]));
    const density = frames.get('scenery_far')!.width / SCENERY_BAND_CSS_WIDTH;
    expect(density).toBeGreaterThan(1);
    // Every band is authored at the same width, and the two that the engine
    // places at exactly their authored size must match the placed size on the
    // vertical axis too. (`scenery_mid` is the deliberate exception: it is
    // authored for the reference canvas and stretched to whatever the live one
    // is, so that a taller screen shows more water.)
    for (const [frameName, band] of [
      ['scenery_far', SCENERY_BANDS.far],
      ['scenery_near', SCENERY_BANDS.near],
    ] as const) {
      const frame = frames.get(frameName)!;
      expect(frame.width).toBe(frames.get('scenery_far')!.width);
      expect(frame.height / (band.bottom - band.top)).toBeCloseTo(density, 1);
    }
    // The water's authored height, on the other hand, is its own thing.
    const mid = frames.get('scenery_mid')!;
    expect(mid.width).toBe(frames.get('scenery_far')!.width);
  });

  it('overlaps the causeway over the water so no seam can open', () => {
    // The road's top edge is above the waterline: the cobbles overhang it.
    expect(SCENERY_BANDS.near.top).toBeLessThan(SCENERY_BANDS.mid.top);
  });

  it('paints the sky as a ramp: red rises all the way down to the horizon', () => {
    // The sunset runs night → indigo → mauve → rose → orange → amber → horizon,
    // so red climbs monotonically. (Blue does *not*: it peaks at the mauve and
    // is most suppressed at the orange, which is what the "warmest row" test
    // below measures.) A monotone ramp is what keeps a nearest-sampled gradient
    // from banding at this size.
    const sky = createGameSpriteFrames().find((f) => f.name === 'sky')!;
    const rows = [0.02, 0.2, 0.4, 0.6, 0.75, 0.88].map((t) =>
      rowMean(sky, Math.min(sky.height - 1, Math.floor(sky.height * t))),
    );
    for (const row of rows) expect(row).not.toBeNull();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.r).toBeGreaterThan(rows[i - 1]!.r);
    }
    // Night is still overhead: the top of the frame is genuinely dark, not a
    // dusk that merely looks dark next to the sun.
    expect(Math.max(rows[0]!.r, rows[0]!.g, rows[0]!.b)).toBeLessThan(100);
    // …and the bottom is far brighter than the top.
    expect(rows[rows.length - 1]!.r).toBeGreaterThan(rows[0]!.r * 4);
  });

  it('puts the warmest sky row near the horizon, with blue most suppressed there', () => {
    // The sun sits low: the reddest, least-blue row is in the lower half but not
    // at the very bottom, where the dusk has already closed back toward violet.
    const sky = createGameSpriteFrames().find((f) => f.name === 'sky')!;
    let bestY = 0;
    let best = -Infinity;
    for (let y = 0; y < sky.height; y++) {
      const row = rowMean(sky, y);
      if (!row) continue;
      const warmth = row.r - row.b;
      if (warmth > best) {
        best = warmth;
        bestY = y;
      }
    }
    expect(bestY / sky.height).toBeGreaterThan(0.5);
    expect(bestY / sky.height).toBeLessThan(0.95);

    // The ramp returns to a pale, much bluer horizon below the orange — which is
    // why a monotone-blue assertion would be wrong about this sunset: blue's
    // global minimum is the night overhead, not the orange.
    const horizon = rowMean(sky, sky.height - 1)!;
    const orange = rowMean(sky, bestY)!;
    expect(horizon.b).toBeGreaterThan(orange.b * 1.5);
  });

  it('gives the water a warm reflection streak under the sun', () => {
    // The reflection column is the single most-remarked feature of the scene. It
    // is painted additively over the water, so it shows as "red leads blue" in a
    // band that is otherwise a cool blue-grey.
    const mid = createGameSpriteFrames().find((f) => f.name === 'scenery_mid')!;
    // Compare the warmest column against the coolest one, over the upper third of
    // the water (the reflection fades out with depth).
    let warmest = -Infinity;
    let coolest = Infinity;
    for (let x = 0; x < mid.width; x++) {
      let warmth = 0;
      let n = 0;
      for (let y = 0; y < Math.floor(mid.height * 0.35); y++) {
        const p = pixelAt(mid, x, y);
        if (p.a === 0) continue;
        warmth += p.r - p.b;
        n++;
      }
      if (n === 0) continue;
      warmth /= n;
      warmest = Math.max(warmest, warmth);
      coolest = Math.min(coolest, warmth);
    }
    expect(warmest).toBeGreaterThan(0);
    expect(warmest - coolest).toBeGreaterThan(20);
  });

  it('draws the lantern room where TOWER_LANTERN_ABOVE_FOOT says it is', () => {
    // The engine places the halo, the flame, the fluency ring and the beam's
    // pivot from this one constant, and they are separate sprites from the tower
    // — so if the constant and the art disagree, the light floats off the glass.
    //
    // The lantern glass is the *only* thing that differs between the lit and the
    // unlit tower, so the centre of mass of that difference is the lantern's
    // centre, with no assumption about which row is brightest (the cream masonry
    // out-shines the glass on any absolute measure).
    const lit = createGameSpriteFrames().find((f) => f.name === 'lighthouse_lit')!;
    const unlit = createGameSpriteFrames().find((f) => f.name === 'lighthouse_unlit')!;
    expect(unlit.width).toBe(lit.width);
    expect(unlit.height).toBe(lit.height);

    let sum = 0;
    let n = 0;
    for (let y = 0; y < lit.height; y++) {
      for (let x = 0; x < lit.width; x++) {
        const a = pixelAt(lit, x, y);
        const b = pixelAt(unlit, x, y);
        if (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 60) {
          sum += y;
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(0);
    const centreY = sum / n;
    const fromFoot = 1 - (centreY + 0.5) / lit.height;
    expect(fromFoot).toBeCloseTo(TOWER_LANTERN_ABOVE_FOOT, 2);
  });

  it('keeps the tower frame taller than it is wide, at TOWER_ASPECT', () => {
    const tower = createGameSpriteFrames().find((f) => f.name === 'lighthouse_lit')!;
    expect(tower.height * TOWER_ASPECT).toBeCloseTo(tower.width, 0);
    expect(TOWER_ASPECT).toBeLessThan(0.5);
  });

  it('anchors the beam at the bottom centre of its frame', () => {
    // The engine rotates the beam about its box centre and relies on the art's
    // apex being the bottom centre: if the painted wedge drifts off that point,
    // the sweep pivots around empty space instead of around the lantern.
    const beam = createGameSpriteFrames().find((f) => f.name === 'beacon_beam')!;

    const extent = (y: number) => {
      let minX = beam.width;
      let maxX = -1;
      for (let x = 0; x < beam.width; x++) {
        if (pixelAt(beam, x, y).a > 0) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      return maxX < 0 ? null : { minX, maxX, w: maxX - minX + 1 };
    };

    const painted: Array<{ y: number; minX: number; maxX: number; w: number }> = [];
    for (let y = 0; y < beam.height; y++) {
      const e = extent(y);
      if (e) painted.push({ y, ...e });
    }
    expect(painted.length).toBeGreaterThan(beam.height * 0.5);

    // The apex is at the bottom: the wedge narrows to a point there. It is not
    // widest at the very top, because the fan's alpha fades out with height.
    const bottom = painted[painted.length - 1];
    const middle = painted[Math.floor(painted.length / 2)];
    expect(bottom.y / beam.height).toBeGreaterThan(0.9);
    expect(bottom.w).toBeLessThan(middle.w);
    // …and every painted row is centred on the frame's vertical axis.
    for (const row of painted) {
      expect((row.minX + row.maxX) / 2).toBeCloseTo(beam.width / 2, -1);
    }
  });
});
