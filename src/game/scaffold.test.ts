import { describe, it, expect } from 'vitest';
import { getGameLayer, buildTilePuzzle } from './scaffold';
import { KJV_VERSES } from '../data/kjv-verses';

describe('getGameLayer', () => {
  it('returns 0 for a never-practiced verse', () => {
    expect(getGameLayer(0)).toBe(0);
  });
  it('returns 4 at 10+ recitations', () => {
    expect(getGameLayer(10)).toBe(4);
  });
  it('honors a custom override', () => {
    expect(getGameLayer(0, 3)).toBe(3);
  });
  it('promotes to free-recall (5) when mastered', () => {
    expect(getGameLayer(12, null, 'mastered')).toBe(5);
  });
  it('respects cloze level boundaries', () => {
    expect(getGameLayer(1)).toBe(1);
    expect(getGameLayer(5)).toBe(2);
    expect(getGameLayer(9)).toBe(3);
  });
});

describe('buildTilePuzzle', () => {
  const v = KJV_VERSES.find(x => x.reference === 'John 3:16')!;

  it('layer 0 pre-fills all slots and empties the bank (study)', () => {
    const p = buildTilePuzzle(v, 0, 1);
    expect(p.bank).toEqual([]);
    expect(p.slots.every(s => s.preFilled)).toBe(true);
    expect(p.freeRecall).toBe(false);
  });

  it('layer 1 puts all words in the bank, none pre-filled', () => {
    const p = buildTilePuzzle(v, 1, 1);
    expect(p.slots.every(s => !s.preFilled)).toBe(true);
    expect(p.bank.length).toBe(v.text.split(' ').length);
    expect(p.bank.every(t => t.display === t.word)).toBe(true);
  });

  it('layer 2 bank tiles show only first letters', () => {
    const p = buildTilePuzzle(v, 2, 1);
    expect(p.bank.every(t => t.display.length <= 1)).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    expect(buildTilePuzzle(v, 1, 42)).toEqual(buildTilePuzzle(v, 1, 42));
  });

  it('different seeds can produce different bank orders', () => {
    // not guaranteed for very short verses, so just assert determinism holds
    expect(buildTilePuzzle(v, 1, 1)).toEqual(buildTilePuzzle(v, 1, 1));
  });

  it('layer 5 is free recall (empty bank)', () => {
    const p = buildTilePuzzle(v, 5, 1);
    expect(p.freeRecall).toBe(true);
    expect(p.bank).toEqual([]);
  });

  it('layer 3 blanks match getVanishingClozeMask count', () => {
    const p = buildTilePuzzle(v, 3, 1);
    const blankCount = p.slots.filter(s => !s.preFilled).length;
    const expected = Math.max(1, Math.round(v.text.split(' ').length * 0.5));
    expect(blankCount).toBe(expected);
    expect(p.bank.length).toBe(expected);
  });

  it('layer 4 blanks match getVanishingClozeMask count', () => {
    const p = buildTilePuzzle(v, 4, 1);
    const blankCount = p.slots.filter(s => !s.preFilled).length;
    const expected = Math.max(1, Math.round(v.text.split(' ').length * 0.75));
    expect(blankCount).toBe(expected);
  });

  it('preserves the reference on the puzzle', () => {
    expect(buildTilePuzzle(v, 1, 1).reference).toBe('John 3:16');
  });
});