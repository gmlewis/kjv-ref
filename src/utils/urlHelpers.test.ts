import { describe, it, expect } from 'vitest';
import { verseAnchorId, buildChapterUrl } from './urlHelpers';

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
