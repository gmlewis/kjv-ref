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
    expect(names).toContain('star');
    expect(names).toContain('moon');
    expect(names).toContain('mountain');
    expect(names).toContain('hills');
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
});
