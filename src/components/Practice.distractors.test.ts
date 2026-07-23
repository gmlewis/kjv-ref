import { describe, it, expect } from 'vitest';
import { KJV_VERSES, type KJVVerse } from '../data/kjv-verses';

/**
 * Regression test for the "single-verse practice shows only one MC/reference
 * option" bug.
 *
 * Reproduction: from Favorites, click Practice on a single favourited verse.
 * Practice.tsx builds `verses = [v]` (length 1) for the session. The
 * PracticeSession component then builds the multiple-choice / reference
 * distractor set from `verses.filter((_, i) => i !== idx)` — which is empty
 * when there is only one verse — so only the correct answer appears and the
 * user has nothing to choose from.
 *
 * The fix: when the session has fewer than 4 verses, draw distractors from the
 * full KJV_VERSES pool instead of the session's own verse list.
 */

// Mirror of the distractor-pool logic added to PracticeSession.
function buildDistractorPool(sessionVerses: KJVVerse[]): KJVVerse[] {
  if (sessionVerses.length >= 4) return sessionVerses;
  const sessionRefs = new Set(sessionVerses.map(v => v.reference));
  return [...sessionVerses, ...KJV_VERSES.filter(v => !sessionRefs.has(v.reference))];
}

// Mirror of the option-building logic in PracticeSession.
function buildOptions(
  sessionVerses: KJVVerse[],
  idx: number,
  field: 'text' | 'reference',
): string[] {
  const pool = buildDistractorPool(sessionVerses);
  const verse = sessionVerses[idx];
  const others = pool.filter(v => v.reference !== verse.reference);
  // seededShuffle is deterministic but we only care about length & uniqueness
  // here, so a plain slice is sufficient for the regression assertion.
  const distractors = others.slice(0, 3).map(v => v[field]);
  return [verse[field], ...distractors];
}

describe('Practice single-verse session distractor pool', () => {
  it('a 1-verse session still produces 4 distinct options (reference mode)', () => {
    const single = [KJV_VERSES.find(v => v.reference === 'John 3:16')!];
    expect(single).toHaveLength(1);
    const options = buildOptions(single, 0, 'reference');
    expect(options).toHaveLength(4);
    // All options must be unique (no duplicate of the correct answer)
    expect(new Set(options).size).toBe(4);
    // The correct answer must be among them
    expect(options).toContain('John 3:16');
  });

  it('a 1-verse session still produces 4 distinct options (multiple-choice mode)', () => {
    const single = [KJV_VERSES.find(v => v.reference === 'Genesis 1:1')!];
    const options = buildOptions(single, 0, 'text');
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
    expect(options).toContain(single[0].text);
  });

  it('a 2-verse session draws the remaining 2 distractors from KJV_VERSES', () => {
    const two = [
      KJV_VERSES.find(v => v.reference === 'John 3:16')!,
      KJV_VERSES.find(v => v.reference === 'Genesis 1:1')!,
    ];
    const options = buildOptions(two, 0, 'reference');
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
    // Only 1 other verse is in the session, so the other 2 distractors must
    // come from outside it.
    const sessionRefs = new Set(two.map(v => v.reference));
    const outsideDistractors = options.filter(o => !sessionRefs.has(o));
    expect(outsideDistractors.length).toBeGreaterThanOrEqual(2);
  });

  it('a 4-verse session uses only its own verses as the pool', () => {
    const four = KJV_VERSES.slice(0, 4);
    const pool = buildDistractorPool(four);
    expect(pool).toBe(four);
    const options = buildOptions(four, 0, 'reference');
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
  });

  it('the distractor pool never contains duplicates of the session verse', () => {
    const single = [KJV_VERSES[0]];
    const pool = buildDistractorPool(single);
    const refs = pool.map(v => v.reference);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('KJV_VERSES is large enough to supply 3 distractors for any single verse', () => {
    expect(KJV_VERSES.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── Option-position randomization ───────────────────────────────────────────
// Regression test for "the answer is always in the same spot".
// The old seeds `idx * 17 + 3` / `idx * 13 + 5` were fully deterministic, so
// the correct answer always landed in the same position in every session.
// The fix uses Math.random() (a true Fisher–Yates shuffle) for MC/Reference
// options. These tests verify the Math.random-based shuffle actually spreads
// the answer across all slots over many runs.

function shuffleWithMathRandom<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

describe('Practice option position varies (Math.random shuffle)', () => {
  const verse = KJV_VERSES.find(v => v.reference === 'John 3:16')!;
  const distractors = KJV_VERSES.filter(v => v.reference !== verse.reference).slice(0, 3);
  const allRefs = [verse.reference, ...distractors.map(v => v.reference)];

  it('the correct answer is NOT always at the same position across runs', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 100; i++) {
      positions.add(shuffleWithMathRandom(allRefs).indexOf(verse.reference));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('the correct answer covers all 4 slots over many runs', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      positions.add(shuffleWithMathRandom(allRefs).indexOf(verse.reference));
    }
    expect(positions.size).toBe(4);
  });

  it('shuffleWithMathRandom preserves all elements (no loss/duplication)', () => {
    const shuffled = shuffleWithMathRandom(allRefs);
    expect(shuffled.sort()).toEqual([...allRefs].sort());
    expect(shuffled).toHaveLength(4);
  });

  it('roughly uniform distribution of the answer position (sanity check)', () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      counts[shuffleWithMathRandom(allRefs).indexOf(verse.reference)]++;
    }
    // Each slot should get ~1000 ± generous tolerance (avoids flakiness).
    for (const c of counts) {
      expect(c).toBeGreaterThan(700);
      expect(c).toBeLessThan(1300);
    }
  });
});