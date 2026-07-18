import { describe, it, expect } from 'vitest';
import { verseAnchorId, buildChapterUrl, parseVerseHash, buildVerseHash, buildChapterUrlRange } from './urlHelpers';

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
