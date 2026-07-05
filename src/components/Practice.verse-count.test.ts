import { describe, it, expect } from 'vitest';
import { KJV_VERSES } from '../data/kjv-verses';

/**
 * Regression test: the "Show N verses in collection" toggle must show the
 * count of verses matching the CURRENT filter, not always the bookmark count.
 *
 * This tests the filtering logic extracted from the Practice component.
 */
function filterVerses(
  difficultyFilter: 'all' | 'easy' | 'medium' | 'hard',
  bookmarkedRefs: Set<string>,
  collectionFilter: boolean,
  extraCollectionVerses: typeof KJV_VERSES = [],
): typeof KJV_VERSES {
  if (collectionFilter) {
    const featured = KJV_VERSES.filter(v => bookmarkedRefs.has(v.reference));
    return [...featured, ...extraCollectionVerses];
  }
  if (difficultyFilter === 'all') return KJV_VERSES;
  return KJV_VERSES.filter(v => v.difficulty === difficultyFilter);
}

describe('Practice verse filtering (collection toggle)', () => {
  const bookmarkedRefs = new Set(['Genesis 1:1', 'John 3:16']);

  it('"All" filter shows all verses, not just bookmarked', () => {
    const verses = filterVerses('all', bookmarkedRefs, false);
    expect(verses.length).toBe(KJV_VERSES.length);
    expect(verses.length).toBeGreaterThan(bookmarkedRefs.size);
  });

  it('"Easy" filter shows only easy verses', () => {
    const verses = filterVerses('easy', bookmarkedRefs, false);
    expect(verses.every(v => v.difficulty === 'easy')).toBe(true);
  });

  it('"Medium" filter shows only medium verses', () => {
    const verses = filterVerses('medium', bookmarkedRefs, false);
    expect(verses.every(v => v.difficulty === 'medium')).toBe(true);
  });

  it('"Hard" filter shows only hard verses', () => {
    const verses = filterVerses('hard', bookmarkedRefs, false);
    expect(verses.every(v => v.difficulty === 'hard')).toBe(true);
  });

  it('"My Collection" filter shows only bookmarked verses', () => {
    const verses = filterVerses('all', bookmarkedRefs, true);
    expect(verses.length).toBe(bookmarkedRefs.size);
    expect(verses.every(v => bookmarkedRefs.has(v.reference))).toBe(true);
  });

  it('each difficulty count is different from bookmark count', () => {
    const allCount = filterVerses('all', bookmarkedRefs, false).length;
    const easyCount = filterVerses('easy', bookmarkedRefs, false).length;
    const mediumCount = filterVerses('medium', bookmarkedRefs, false).length;
    const hardCount = filterVerses('hard', bookmarkedRefs, false).length;
    const collectionCount = filterVerses('all', bookmarkedRefs, true).length;

    // Bookmark count should differ from at least some filters
    expect(collectionCount).toBe(bookmarkedRefs.size);
    expect(allCount).not.toBe(collectionCount);
    expect(allCount).toBe(easyCount + mediumCount + hardCount);
  });
});
