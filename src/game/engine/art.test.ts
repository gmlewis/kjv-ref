import { describe, it, expect } from 'vitest';
import { createGameSpriteFrames } from './art';

describe('createGameSpriteFrames', () => {
  it('returns array of valid sprite frame specifications', () => {
    const frames = createGameSpriteFrames();
    expect(Array.isArray(frames)).toBe(true);
    expect(frames.length).toBeGreaterThan(5);
  });

  it('includes mandatory frame names for the game engine', () => {
    const frames = createGameSpriteFrames();
    const names = frames.map((f) => f.name);
    expect(names).toContain('w');
    expect(names).toContain('lamp_unlit');
    expect(names).toContain('lamp_lit');
    expect(names).toContain('lighthouse_unlit');
    expect(names).toContain('lighthouse_lit');
    expect(names).toContain('beacon_beam');
    expect(names).toContain('flame');
    expect(names).toContain('glow_halo');
    expect(names).toContain('fluency_ring');
    expect(names).toContain('star');
    expect(names).toContain('moon');
    expect(names).toContain('mountain');
    expect(names).toContain('hills');
    expect(names).toContain('forest_hills');
    expect(names).toContain('ocean_water');
    expect(names).toContain('waterfall');
    expect(names).toContain('city');
    expect(names).toContain('path_stone');
    expect(names).toContain('tile_bg');
    expect(names).toContain('slot_bg');
    expect(names).toContain('sky_dark');
    expect(names).toContain('sky_light');
  });

  it('provides correct Uint8Array pixel buffer sizes for each frame', () => {
    const frames = createGameSpriteFrames();
    for (const frame of frames) {
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
      expect(frame.pixels).toBeInstanceOf(Uint8Array);
      expect(frame.pixels.length).toBe(frame.width * frame.height * 4);
    }
  });

  it('generates non-trivial pixels (non-zero alpha) for sprite artwork', () => {
    const frames = createGameSpriteFrames();
    const lampLit = frames.find((f) => f.name === 'lamp_lit');
    expect(lampLit).toBeDefined();
    if (lampLit) {
      let hasAlpha = false;
      for (let i = 3; i < lampLit.pixels.length; i += 4) {
        if (lampLit.pixels[i] > 0) {
          hasAlpha = true;
          break;
        }
      }
      expect(hasAlpha).toBe(true);
    }
  });

  // drawRect overwrites pixels instead of blending, so the order two overlapping
  // rects are painted in decides which one survives. Both of these frames painted
  // a wide translucent rect over a narrow bright one and lost the bright one.
  const pixelAt = (frame: { width: number; pixels: Uint8Array }, x: number, y: number) => {
    const i = (y * frame.width + x) * 4;
    return { r: frame.pixels[i], g: frame.pixels[i + 1], b: frame.pixels[i + 2], a: frame.pixels[i + 3] };
  };

  it('paints the waterfall foam core on top of its cyan spray', () => {
    const waterfall = createGameSpriteFrames().find((f) => f.name === 'waterfall');
    expect(waterfall).toBeDefined();
    if (!waterfall) return;

    // x=8 is the centre of the foam core (wx-3..wx+3 at y=0, where wave=0), and
    // it sits inside the 10px spray band painted before it. Before the fix the
    // spray was painted last, so this pixel was cyan (56,189,248) and the stream
    // had no white water at all.
    const core = pixelAt(waterfall, 8, 0);
    expect(core.r).toBeGreaterThan(220);
    expect(core.g).toBeGreaterThan(220);
    expect(core.b).toBeGreaterThan(220);

    // The spray still surrounds the core: x=3 is outside wx-3..wx+3.
    const spray = pixelAt(waterfall, 3, 0);
    expect(spray.b).toBeGreaterThan(spray.r);
  });

  it('gives the city citadel a hill coloured like the other hill layers', () => {
    const city = createGameSpriteFrames().find((f) => f.name === 'city');
    expect(city).toBeDefined();
    if (!city) return;

    // Sample the bottom row well left of the citadel (x=4, hillY=41 at that
    // column), which the sprite used to paint with its hard dark slate
    // (30,41,59): g-r was 11 there and the opaque band read as a black box
    // pasted over the hills. The emerald ramp the other hill layers use is
    // strongly green-dominant.
    const hill = pixelAt(city, 4, 63);
    expect(hill.a).toBeGreaterThan(0);
    expect(hill.g - hill.r).toBeGreaterThan(60);

    // Above the hill line the citadel is still gold (r above g) — the fix must
    // not have recoloured the building itself.
    const wall = pixelAt(city, 64, 20);
    expect(wall.r).toBeGreaterThan(wall.g);
  });
});
