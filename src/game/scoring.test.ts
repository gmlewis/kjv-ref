import { describe, it, expect } from 'vitest';
import { scoreTilePuzzle, performanceRating, computeXp, applyCombo, levelForXp } from './scoring';

describe('scoreTilePuzzle', () => {
  const target = 'In the beginning God created the heaven and the earth';
  it('correct order → correct:true, accuracy:100', () => {
    const r = scoreTilePuzzle(target.split(' '), target);
    expect(r.correct).toBe(true); expect(r.accuracy).toBe(100);
  });
  it('wrong order → correct:false', () => {
    const r = scoreTilePuzzle([...target.split(' ')].reverse(), target);
    expect(r.correct).toBe(false); expect(r.accuracy).toBeLessThan(100);
  });
  it('empty placement → correct:false, accuracy:0', () => {
    const r = scoreTilePuzzle([], target);
    expect(r.correct).toBe(false); expect(r.accuracy).toBe(0);
  });
});

describe('performanceRating', () => {
  it('correct, no hint, fluent → excellent', () => { expect(performanceRating(true, false, true)).toBe('excellent'); });
  it('correct with hint → good', () => { expect(performanceRating(true, true, true)).toBe('good'); });
  it('correct, no hint, not fluent → good', () => { expect(performanceRating(true, false, false)).toBe('good'); });
  it('wrong → poor', () => { expect(performanceRating(false, false, false)).toBe('poor'); });
});

describe('applyCombo', () => {
  it('increments on correct', () => { expect(applyCombo(3, true)).toBe(4); });
  it('resets to 0 on wrong', () => { expect(applyCombo(5, false)).toBe(0); });
  it('starts from 0', () => { expect(applyCombo(0, true)).toBe(1); });
});

describe('computeXp', () => {
  it('rises with layer', () => {
    expect(computeXp(3, 10, true, 0)).toBeGreaterThan(computeXp(1, 10, true, 0));
  });
  it('rises with fluency', () => {
    expect(computeXp(2, 10, true, 0)).toBeGreaterThan(computeXp(2, 10, false, 0));
  });
  it('rises with combo', () => {
    expect(computeXp(2, 10, true, 5)).toBeGreaterThan(computeXp(2, 10, true, 0));
  });
  it('rises with verse length', () => {
    expect(computeXp(2, 20, true, 0)).toBeGreaterThan(computeXp(2, 5, true, 0));
  });
  it('is always positive', () => {
    expect(computeXp(0, 1, false, 0)).toBeGreaterThan(0);
  });
});

describe('levelForXp', () => {
  it('starts at 0', () => { expect(levelForXp(0)).toBe(0); });
  it('is non-decreasing', () => {
    let prev = 0;
    for (let xp = 0; xp <= 10000; xp += 250) {
      const lvl = levelForXp(xp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });
  it('eventually exceeds 0', () => { expect(levelForXp(1e9)).toBeGreaterThan(0); });
});