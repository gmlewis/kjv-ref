import { describe, it, expect } from 'vitest';
import { getGameLayer, buildTilePuzzle, decoyCountFor } from './scaffold';
import { KJV_VERSES } from '../data/kjv-verses';

// A small decoy pool drawn from other verses' words, used for stages ≥ 2.
const POOL = KJV_VERSES.flatMap((v) => v.text.split(' '));

describe('getGameLayer', () => {
  it('returns 0 for a never-practiced verse', () => {
    expect(getGameLayer(0)).toBe(0);
  });
  it('auto-advances with recitation count', () => {
    expect(getGameLayer(1)).toBe(1);
    expect(getGameLayer(2)).toBe(1);
    expect(getGameLayer(3)).toBe(2);
    expect(getGameLayer(5)).toBe(3);
    expect(getGameLayer(7)).toBe(4);
    expect(getGameLayer(10)).toBe(5);
  });
  it('honors a custom override (even over mastered)', () => {
    expect(getGameLayer(0, 3)).toBe(3);
    expect(getGameLayer(20, 0, 'mastered')).toBe(0); // override beats mastered
  });
  it('promotes to stage 5 when mastered with no override', () => {
    expect(getGameLayer(12, null, 'mastered')).toBe(5);
  });
});

describe('decoyCountFor', () => {
  it('is 0 for stages 0 and 1, then grows by 2 per stage', () => {
    expect(decoyCountFor(0)).toBe(0);
    expect(decoyCountFor(1)).toBe(0);
    expect(decoyCountFor(2)).toBe(2);
    expect(decoyCountFor(3)).toBe(4);
    expect(decoyCountFor(4)).toBe(6);
    expect(decoyCountFor(5)).toBe(8);
  });
});

describe('buildTilePuzzle', () => {
  const v = KJV_VERSES.find((x) => x.reference === 'John 3:16')!;
  const wordCount = v.text.split(' ').length;

  it('stage 0 pre-fills all slots and empties the bank (read-along)', () => {
    const p = buildTilePuzzle(v, 0, 1);
    expect(p.bank).toEqual([]);
    expect(p.slots.every((s) => s.preFilled)).toBe(true);
    expect(p.decoyCount).toBe(0);
  });

  it('stage 1 puts all words in the bank, none pre-filled, no decoys', () => {
    const p = buildTilePuzzle(v, 1, 1, POOL);
    expect(p.slots.every((s) => !s.preFilled)).toBe(true);
    expect(p.bank.length).toBe(wordCount);
    expect(p.decoyCount).toBe(0);
    expect(p.bank.every((t) => t.display === t.word)).toBe(true);
  });

  it('stage 2 adds exactly 2 decoys not present in the verse', () => {
    const p = buildTilePuzzle(v, 2, 1, POOL);
    expect(p.decoyCount).toBe(2);
    expect(p.bank.length).toBe(wordCount + 2);
    const verseWords = new Set(v.text.split(' ').map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')));
    const decoys = p.bank.filter((t) => t.id.startsWith('d'));
    expect(decoys.length).toBe(2);
    expect(decoys.every((d) => !verseWords.has(d.word.toLowerCase().replace(/[^a-z0-9]/g, '')))).toBe(true);
  });

  it('stage 5 adds 8 decoys', () => {
    const p = buildTilePuzzle(v, 5, 1, POOL);
    expect(p.decoyCount).toBe(8);
    expect(p.bank.length).toBe(wordCount + 8);
  });

  it('decoy count degrades gracefully when the pool is empty', () => {
    const p = buildTilePuzzle(v, 5, 1, []);
    expect(p.decoyCount).toBe(0);
    expect(p.bank.length).toBe(wordCount);
  });

  it('is deterministic for a fixed seed', () => {
    expect(buildTilePuzzle(v, 1, 42, POOL)).toEqual(buildTilePuzzle(v, 1, 42, POOL));
    expect(buildTilePuzzle(v, 3, 7, POOL)).toEqual(buildTilePuzzle(v, 3, 7, POOL));
  });

  it('preserves the reference and stage on the puzzle', () => {
    const p = buildTilePuzzle(v, 4, 1, POOL);
    expect(p.reference).toBe('John 3:16');
    expect(p.layer).toBe(4);
  });
});