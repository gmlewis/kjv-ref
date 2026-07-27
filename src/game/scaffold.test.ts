import { describe, it, expect } from 'vitest';
import { getGameLayer, buildTilePuzzle, decoyCountFor, buildMultiVersePuzzle } from './scaffold';
import { KJV_VERSES } from '../data/kjv-verses';
import type { KJVVerse } from '../data/kjv-verses';

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

  it('randomizes bank tile order via Math.random when seed is omitted', () => {
    // Generate multiple puzzles without passing a seed
    const p1 = buildTilePuzzle(v, 1, undefined, POOL);
    const p2 = buildTilePuzzle(v, 1, undefined, POOL);
    const p3 = buildTilePuzzle(v, 1, undefined, POOL);
    // All 3 puzzles contain the same tile set, but their bank display order will differ
    const bank1 = p1.bank.map((t) => t.display);
    const bank2 = p2.bank.map((t) => t.display);
    const bank3 = p3.bank.map((t) => t.display);
    expect(bank1).toHaveLength(wordCount);
    // At least one pair out of 3 should have different word order
    const isDifferent = JSON.stringify(bank1) !== JSON.stringify(bank2) || JSON.stringify(bank1) !== JSON.stringify(bank3);
    expect(isDifferent).toBe(true);
  });

  it('preserves the reference and stage on the puzzle', () => {
    const p = buildTilePuzzle(v, 4, 1, POOL);
    expect(p.reference).toBe('John 3:16');
    expect(p.layer).toBe(4);
  });
});

describe('buildMultiVersePuzzle', () => {
  const v1: KJVVerse = { reference: 'Psalm 23:1', book: 'Psalms', chapter: 23, verse: 1, text: 'The LORD is my shepherd; I shall not want.', keywords: ['shepherd'], difficulty: 'easy', theme: 'faith' };
  const v2: KJVVerse = { reference: 'Psalm 23:2', book: 'Psalms', chapter: 23, verse: 2, text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.', keywords: ['pastures'], difficulty: 'easy', theme: 'faith' };
  const v3: KJVVerse = { reference: 'Psalm 23:3', book: 'Psalms', chapter: 23, verse: 3, text: `He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.`, keywords: ['soul'], difficulty: 'easy', theme: 'faith' };

  it('combines consecutive verses into a single multi-verse passage puzzle', () => {
    const p = buildMultiVersePuzzle([v1, v2], 1, 42, POOL);
    expect(p.reference).toBe('Psalm 23:1–2');
    const combinedLength = v1.text.split(' ').length + v2.text.split(' ').length;
    expect(p.slots.length).toBe(combinedLength);
    expect(p.bank.length).toBe(combinedLength);
  });

  it('handles three or more verses in a chain', () => {
    const p = buildMultiVersePuzzle([v1, v2, v3], 2, 42, POOL);
    expect(p.reference).toBe('Psalm 23:1–3');
    const combinedLength = v1.text.split(' ').length + v2.text.split(' ').length + v3.text.split(' ').length;
    expect(p.slots.length).toBe(combinedLength);
    expect(p.bank.length).toBe(combinedLength + 2); // stage 2 adds 2 decoys
  });

  it('returns single verse puzzle for one verse', () => {
    const p = buildMultiVersePuzzle([v1], 1, 42, POOL);
    expect(p.reference).toBe('Psalm 23:1');
    expect(p.slots.length).toBe(v1.text.split(' ').length);
  });

  it('returns empty puzzle for no verses', () => {
    const p = buildMultiVersePuzzle([], 1, 42, POOL);
    expect(p.reference).toBe('');
    expect(p.slots.length).toBe(0);
    expect(p.bank.length).toBe(0);
  });

  it('applies decoys based on stage for multi-verse puzzles', () => {
    const p0 = buildMultiVersePuzzle([v1, v2], 0, 42, POOL);
    const p3 = buildMultiVersePuzzle([v1, v2], 3, 42, POOL);
    const p5 = buildMultiVersePuzzle([v1, v2], 5, 42, POOL);
    expect(p0.decoyCount).toBe(0);
    expect(p3.decoyCount).toBe(4);
    expect(p5.decoyCount).toBe(8);
  });
});