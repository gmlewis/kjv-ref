import { describe, it, expect } from 'vitest';
import { verseAnchorId, buildChapterUrl, parseVerseHash, buildVerseHash, buildChapterUrlRange, parseVerseRef, parseVerseRangeRef } from './urlHelpers';

describe('verseAnchorId', () => {
  it('returns "v16" for verse 16', () => {
    expect(verseAnchorId(16)).toBe('v16');
  });
  it('returns "v1" for verse 1', () => {
    expect(verseAnchorId(1)).toBe('v1');
  });
  it('returns "v105" for verse 105', () => {
    expect(verseAnchorId(105)).toBe('v105');
  });
});

describe('buildChapterUrl', () => {
  it('builds url without verse', () => {
    expect(buildChapterUrl('John', 3)).toBe('/books/John/3');
  });
  it('builds url with verse anchor', () => {
    expect(buildChapterUrl('John', 3, 16)).toBe('/books/John/3#v16');
  });
  it('encodes book name with spaces', () => {
    expect(buildChapterUrl('1 Kings', 1, 1)).toBe('/books/1%20Kings/1#v1');
  });
  it('encodes book name with spaces — no verse', () => {
    expect(buildChapterUrl('Song of Solomon', 1)).toBe('/books/Song%20of%20Solomon/1');
  });
});

// ─── Verse range hash tests ──────────────────────────────────────────────────

describe('parseVerseHash', () => {
  it('parses single verse "#v16"', () => {
    expect(parseVerseHash('#v16')).toEqual({ start: 16, end: 16 });
  });

  it('parses single verse "#v1"', () => {
    expect(parseVerseHash('#v1')).toEqual({ start: 1, end: 1 });
  });

  it('parses verse range "#v1-6"', () => {
    expect(parseVerseHash('#v1-6')).toEqual({ start: 1, end: 6 });
  });

  it('parses verse range "#v3-10"', () => {
    expect(parseVerseHash('#v3-10')).toEqual({ start: 3, end: 10 });
  });

  it('parses large verse numbers "#v176"', () => {
    expect(parseVerseHash('#v176')).toEqual({ start: 176, end: 176 });
  });

  it('returns null for empty hash', () => {
    expect(parseVerseHash('')).toBeNull();
  });

  it('returns null for hash without #v prefix', () => {
    expect(parseVerseHash('#foo')).toBeNull();
  });

  it('returns null for "#v" with no number', () => {
    expect(parseVerseHash('#v')).toBeNull();
  });

  it('returns null for non-numeric', () => {
    expect(parseVerseHash('#vabc')).toBeNull();
  });

  it('returns null for reversed range (end < start)', () => {
    expect(parseVerseHash('#v6-1')).toBeNull();
  });

  it('returns null for range with no end number', () => {
    expect(parseVerseHash('#v1-')).toBeNull();
  });

  it('handles single-verse range "#v5-5"', () => {
    expect(parseVerseHash('#v5-5')).toEqual({ start: 5, end: 5 });
  });
});

describe('buildVerseHash', () => {
  it('builds "#v16" for single verse', () => {
    expect(buildVerseHash({ start: 16, end: 16 })).toBe('#v16');
  });

  it('builds "#v1-6" for range', () => {
    expect(buildVerseHash({ start: 1, end: 6 })).toBe('#v1-6');
  });

  it('builds "#v3-10" for range', () => {
    expect(buildVerseHash({ start: 3, end: 10 })).toBe('#v3-10');
  });

  it('builds "#v5-5" as single verse (start === end)', () => {
    expect(buildVerseHash({ start: 5, end: 5 })).toBe('#v5');
  });
});

describe('buildChapterUrlRange', () => {
  it('builds url without range', () => {
    expect(buildChapterUrlRange('John', 3)).toBe('/books/John/3');
  });

  it('builds url with single verse', () => {
    expect(buildChapterUrlRange('John', 3, { start: 16, end: 16 })).toBe('/books/John/3#v16');
  });

  it('builds url with verse range', () => {
    expect(buildChapterUrlRange('Psalms', 23, { start: 1, end: 6 })).toBe('/books/Psalms/23#v1-6');
  });

  it('encodes book name with spaces', () => {
    expect(buildChapterUrlRange('1 Kings', 1, { start: 1, end: 3 })).toBe('/books/1%20Kings/1#v1-3');
  });
});

// ─── parseVerseRangeRef tests ────────────────────────────────────────────────

describe('parseVerseRangeRef', () => {
  it('parses single verse "John 3:16"', () => {
    expect(parseVerseRangeRef('John 3:16')).toEqual({
      book: 'John', chapter: 3, verseStart: 16, verseEnd: 16,
    });
  });

  it('parses verse range "Psalms 23:1-6"', () => {
    expect(parseVerseRangeRef('Psalms 23:1-6')).toEqual({
      book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6,
    });
  });

  it('parses multi-word book with range "Song of Solomon 1:1-4"', () => {
    expect(parseVerseRangeRef('Song of Solomon 1:1-4')).toEqual({
      book: 'Song of Solomon', chapter: 1, verseStart: 1, verseEnd: 4,
    });
  });

  it('parses numbered book with range "1 Corinthians 13:1-13"', () => {
    expect(parseVerseRangeRef('1 Corinthians 13:1-13')).toEqual({
      book: '1 Corinthians', chapter: 13, verseStart: 1, verseEnd: 13,
    });
  });

  it('parses large verse range "Romans 8:28-39"', () => {
    expect(parseVerseRangeRef('Romans 8:28-39')).toEqual({
      book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 39,
    });
  });

  it('rejects reversed range "John 3:6-1"', () => {
    expect(parseVerseRangeRef('John 3:6-1')).toBeNull();
  });

  it('returns null for invalid string', () => {
    expect(parseVerseRangeRef('not a reference')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseVerseRangeRef('')).toBeNull();
  });

  it('handles single-verse range (start === end)', () => {
    expect(parseVerseRangeRef('John 3:16-16')).toEqual({
      book: 'John', chapter: 3, verseStart: 16, verseEnd: 16,
    });
  });
});
