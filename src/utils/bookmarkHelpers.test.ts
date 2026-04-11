import { describe, it, expect } from 'vitest';
import type { KJVVerseEntry } from '../data/kjv-bible';
import {
  isBookmarked,
  sortBookmarkedFirst,
  filterToBookmarked,
} from './bookmarkHelpers';

const makeVerse = (reference: string, verse = 1): KJVVerseEntry => ({
  verse,
  text: `Text for ${reference}`,
  reference,
});

describe('isBookmarked', () => {
  // 2.2.1
  it('returns true when reference is in bookmarkedRefs', () => {
    expect(isBookmarked('John 3:16', ['John 3:16', 'Psalm 23:1'])).toBe(true);
  });

  // 2.2.2
  it('returns false when reference is not in bookmarkedRefs', () => {
    expect(isBookmarked('Romans 8:28', ['John 3:16'])).toBe(false);
  });

  // 2.2.3
  it('returns false when bookmarkedRefs is empty', () => {
    expect(isBookmarked('John 3:16', [])).toBe(false);
  });
});

describe('sortBookmarkedFirst', () => {
  // 2.2.4
  it('places bookmarked verses before un-bookmarked ones, preserving relative order', () => {
    const verses = [
      makeVerse('Genesis 1:1'),
      makeVerse('John 3:16'),
      makeVerse('Psalm 23:1'),
      makeVerse('Romans 8:28'),
    ];
    const bookmarkedRefs = ['John 3:16', 'Psalm 23:1'];
    const result = sortBookmarkedFirst(verses, bookmarkedRefs);
    expect(result[0].reference).toBe('John 3:16');
    expect(result[1].reference).toBe('Psalm 23:1');
    expect(result[2].reference).toBe('Genesis 1:1');
    expect(result[3].reference).toBe('Romans 8:28');
  });

  // 2.2.5
  it('returns verses in original order when bookmarkedRefs is empty', () => {
    const verses = [
      makeVerse('Genesis 1:1'),
      makeVerse('John 3:16'),
      makeVerse('Psalm 23:1'),
    ];
    const result = sortBookmarkedFirst(verses, []);
    expect(result.map(v => v.reference)).toEqual([
      'Genesis 1:1',
      'John 3:16',
      'Psalm 23:1',
    ]);
  });
});

describe('filterToBookmarked', () => {
  // 2.2.6
  it('returns only verses whose reference appears in refs', () => {
    const verses = [
      makeVerse('Genesis 1:1'),
      makeVerse('John 3:16'),
      makeVerse('Psalm 23:1'),
      makeVerse('Romans 8:28'),
    ];
    const result = filterToBookmarked(verses, ['John 3:16', 'Romans 8:28']);
    expect(result).toHaveLength(2);
    expect(result.map(v => v.reference)).toEqual(['John 3:16', 'Romans 8:28']);
  });

  // 2.2.7
  it('returns [] when verses is empty', () => {
    const result = filterToBookmarked([], ['John 3:16']);
    expect(result).toEqual([]);
  });
});
