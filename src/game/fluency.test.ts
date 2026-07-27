import { describe, it, expect } from 'vitest';
import { fluencyDurationMs, depletionFraction, isFluentNow, ringOpacityFor, ringPulseScale } from './fluency';

describe('fluencyDurationMs', () => {
  it('returns ~20s for a 10-word verse', () => {
    expect(fluencyDurationMs(10)).toBe(20000);
  });
  it('returns ~30s for a 20-word verse', () => {
    expect(fluencyDurationMs(20)).toBe(30000);
  });
  it('returns ~40s for a 30-word verse', () => {
    expect(fluencyDurationMs(30)).toBe(40000);
  });
  it('clamps to a minimum of 5s for very short verses', () => {
    expect(fluencyDurationMs(1)).toBe(5000);
  });
  it('clamps to a maximum of 40s for very long verses', () => {
    expect(fluencyDurationMs(100)).toBe(40000);
  });
  it('is monotonically non-decreasing in word count (within clamp range)', () => {
    const ms10 = fluencyDurationMs(10);
    const ms20 = fluencyDurationMs(20);
    const ms30 = fluencyDurationMs(30);
    expect(ms20).toBeGreaterThanOrEqual(ms10);
    expect(ms30).toBeGreaterThanOrEqual(ms20);
  });
});

describe('depletionFraction', () => {
  it('is 1 when no time has elapsed', () => {
    expect(depletionFraction(1000, 1000, 20000)).toBe(1);
  });
  it('is 0.5 when half the duration has elapsed', () => {
    expect(depletionFraction(1000, 11000, 20000)).toBeCloseTo(0.5, 5);
  });
  it('is 0 when the entire duration has elapsed', () => {
    expect(depletionFraction(1000, 21000, 20000)).toBe(0);
  });
  it('is 0 when past the end', () => {
    expect(depletionFraction(1000, 999999, 20000)).toBe(0);
  });
  it('returns 0 for non-positive duration', () => {
    expect(depletionFraction(0, 100, 0)).toBe(0);
  });
});

describe('isFluentNow', () => {
  it('is true at the start of the puzzle', () => {
    expect(isFluentNow(1000, 1000, 20000)).toBe(true);
  });
  it('is true mid-way through', () => {
    expect(isFluentNow(1000, 10000, 20000)).toBe(true);
  });
  it('is false after the duration expires', () => {
    expect(isFluentNow(1000, 999999, 20000)).toBe(false);
  });
});

describe('ringOpacityFor', () => {
  it('is 1 while fresh', () => {
    expect(ringOpacityFor(1)).toBe(1);
    expect(ringOpacityFor(0.5)).toBe(1);
    expect(ringOpacityFor(0.25)).toBe(1);
  });
  it('fades to 0 over the last 25%', () => {
    expect(ringOpacityFor(0.125)).toBeCloseTo(0.5, 5);
    expect(ringOpacityFor(0)).toBe(0);
  });
});

describe('ringPulseScale', () => {
  it('returns a value near 1.0', () => {
    const v = ringPulseScale(1, 0);
    expect(v).toBeGreaterThan(0.9);
    expect(v).toBeLessThan(1.1);
  });
  it('shrinks as the ring depletes', () => {
    const fresh = ringPulseScale(1, 100);
    const depleted = ringPulseScale(0.1, 100);
    expect(depleted).toBeLessThan(fresh);
  });
});
