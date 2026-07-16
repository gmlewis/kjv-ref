import { describe, it, expect } from 'vitest';
import { getNextVerse, getPrevVerse, getPrevNextChapter } from './bibleBooks';

describe('getNextVerse', () => {
  // ─── No verse in URL (null) ──────────────────────────────────────────────

  it('jumps to verse 1 when currentVerse is null', () => {
    expect(getNextVerse('John', 3, null, 36)).toEqual({ book: 'John', chapter: 3, verse: 1 });
  });

  it('jumps to verse 1 when currentVerse is null even on chapter 1', () => {
    expect(getNextVerse('Genesis', 1, null, 31)).toEqual({ book: 'Genesis', chapter: 1, verse: 1 });
  });

  // ─── Within-chapter advance ──────────────────────────────────────────────

  it('advances verse 1 → 2 within the same chapter', () => {
    expect(getNextVerse('John', 3, 1, 36)).toEqual({ book: 'John', chapter: 3, verse: 2 });
  });

  it('advances verse 16 → 17 within the same chapter', () => {
    expect(getNextVerse('John', 3, 16, 36)).toEqual({ book: 'John', chapter: 3, verse: 17 });
  });

  it('advances verse 35 → 36 (second-to-last) within the same chapter', () => {
    expect(getNextVerse('John', 3, 35, 36)).toEqual({ book: 'John', chapter: 3, verse: 36 });
  });

  // ─── Cross-chapter wraparound (within-book) ──────────────────────────────

  it('wraps from last verse of John 3 to verse 1 of John 4', () => {
    expect(getNextVerse('John', 3, 36, 36)).toEqual({ book: 'John', chapter: 4, verse: 1 });
  });

  it('wraps from last verse of Genesis 1 to verse 1 of Genesis 2', () => {
    expect(getNextVerse('Genesis', 1, 31, 31)).toEqual({ book: 'Genesis', chapter: 2, verse: 1 });
  });

  // ─── Cross-book wraparound ───────────────────────────────────────────────

  it('wraps from last verse of Malachi 4 to verse 1 of Matthew 1', () => {
    expect(getNextVerse('Malachi', 4, 6, 6)).toEqual({ book: 'Matthew', chapter: 1, verse: 1 });
  });

  it('wraps from last verse of Genesis 50 to verse 1 of Exodus 1', () => {
    expect(getNextVerse('Genesis', 50, 26, 26)).toEqual({ book: 'Exodus', chapter: 1, verse: 1 });
  });

  // ─── Bible wraparound ────────────────────────────────────────────────────

  it('wraps from last verse of Revelation 22 to verse 1 of Genesis 1', () => {
    expect(getNextVerse('Revelation', 22, 21, 21)).toEqual({ book: 'Genesis', chapter: 1, verse: 1 });
  });

  // ─── Single-chapter books ────────────────────────────────────────────────

  it('wraps from last verse of Obadiah 1 to verse 1 of Jonah 1', () => {
    expect(getNextVerse('Obadiah', 1, 21, 21)).toEqual({ book: 'Jonah', chapter: 1, verse: 1 });
  });

  it('wraps from last verse of Jude 1 to verse 1 of Revelation 1', () => {
    expect(getNextVerse('Jude', 1, 25, 25)).toEqual({ book: 'Revelation', chapter: 1, verse: 1 });
  });

  // ─── Edge: currentVerse exceeds chapterVerseCount (defensive) ────────────

  it('wraps to next chapter when currentVerse exceeds verse count', () => {
    expect(getNextVerse('John', 3, 99, 36)).toEqual({ book: 'John', chapter: 4, verse: 1 });
  });
});

describe('getPrevVerse', () => {
  // ─── No verse in URL (null) → go to previous chapter's last verse ────────

  it('returns null verse (prev chapter) when currentVerse is null', () => {
    expect(getPrevVerse('John', 3, null)).toEqual({ book: 'John', chapter: 2, verse: null });
  });

  it('returns null verse wrapping cross-book when currentVerse is null at chapter 1', () => {
    expect(getPrevVerse('Matthew', 1, null)).toEqual({ book: 'Malachi', chapter: 4, verse: null });
  });

  it('returns null verse with Bible wraparound when currentVerse is null at Genesis 1', () => {
    expect(getPrevVerse('Genesis', 1, null)).toEqual({ book: 'Revelation', chapter: 22, verse: null });
  });

  // ─── Within-chapter retreat ──────────────────────────────────────────────

  it('retreats verse 2 → 1 within the same chapter', () => {
    expect(getPrevVerse('John', 3, 2)).toEqual({ book: 'John', chapter: 3, verse: 1 });
  });

  it('retreats verse 16 → 15 within the same chapter', () => {
    expect(getPrevVerse('John', 3, 16)).toEqual({ book: 'John', chapter: 3, verse: 15 });
  });

  it('retreats verse 36 → 35 within the same chapter', () => {
    expect(getPrevVerse('John', 3, 36)).toEqual({ book: 'John', chapter: 3, verse: 35 });
  });

  // ─── Cross-chapter wraparound (verse 1 → prev chapter) ───────────────────

  it('wraps from verse 1 of John 3 to previous chapter (John 2, last verse)', () => {
    expect(getPrevVerse('John', 3, 1)).toEqual({ book: 'John', chapter: 2, verse: null });
  });

  it('wraps from verse 1 of Genesis 2 to previous chapter (Genesis 1, last verse)', () => {
    expect(getPrevVerse('Genesis', 2, 1)).toEqual({ book: 'Genesis', chapter: 1, verse: null });
  });

  // ─── Cross-book wraparound ───────────────────────────────────────────────

  it('wraps from verse 1 of Matthew 1 to Malachi 4 (cross-book)', () => {
    expect(getPrevVerse('Matthew', 1, 1)).toEqual({ book: 'Malachi', chapter: 4, verse: null });
  });

  it('wraps from verse 1 of Exodus 1 to Genesis 50 (cross-book)', () => {
    expect(getPrevVerse('Exodus', 1, 1)).toEqual({ book: 'Genesis', chapter: 50, verse: null });
  });

  // ─── Bible wraparound ────────────────────────────────────────────────────

  it('wraps from verse 1 of Genesis 1 to Revelation 22 (Bible wraparound)', () => {
    expect(getPrevVerse('Genesis', 1, 1)).toEqual({ book: 'Revelation', chapter: 22, verse: null });
  });

  // ─── Single-chapter books ────────────────────────────────────────────────

  it('wraps from verse 1 of Jonah 1 to Obadiah 1 (cross-book, single-chapter)', () => {
    expect(getPrevVerse('Jonah', 1, 1)).toEqual({ book: 'Obadiah', chapter: 1, verse: null });
  });

  it('wraps from verse 1 of Revelation 1 to Jude 1 (cross-book, single-chapter)', () => {
    expect(getPrevVerse('Revelation', 1, 1)).toEqual({ book: 'Jude', chapter: 1, verse: null });
  });
});

describe('getNextVerse / getPrevVerse round-trip consistency', () => {
  it('next then prev returns to the same chapter (within-chapter)', () => {
    // John 3:16 → next → John 3:17 → prev → John 3:16
    const next = getNextVerse('John', 3, 16, 36);
    expect(next).toEqual({ book: 'John', chapter: 3, verse: 17 });
    const prev = getPrevVerse(next.book, next.chapter, next.verse);
    expect(prev).toEqual({ book: 'John', chapter: 3, verse: 16 });
  });

  it('prev-then-next round-trips through a chapter boundary (verse known)', () => {
    // John 3:1 → prev → John 2:last → next → John 3:1
    const prev = getPrevVerse('John', 3, 1);
    expect(prev).toEqual({ book: 'John', chapter: 2, verse: null });
    // Simulate caller resolving verse null → 25 (John 2 has 25 verses)
    const resolvedVerse = 25;
    const next = getNextVerse(prev.book, prev.chapter, resolvedVerse, 25);
    expect(next).toEqual({ book: 'John', chapter: 3, verse: 1 });
  });

  it('null-verse next lands on verse 1, then prev returns to previous chapter', () => {
    // John 3, no verse → next → John 3:1 → prev → John 2:last
    const next = getNextVerse('John', 3, null, 36);
    expect(next).toEqual({ book: 'John', chapter: 3, verse: 1 });
    const prev = getPrevVerse(next.book, next.chapter, next.verse);
    expect(prev).toEqual({ book: 'John', chapter: 2, verse: null });
  });
});

describe('getNextVerse / getPrevVerse use getPrevNextChapter for chapter wraparound', () => {
  it('next verse chapter wrap matches getPrevNextChapter next', () => {
    const { next: chapterNext } = getPrevNextChapter('John', 3);
    const verseNext = getNextVerse('John', 3, 36, 36);
    expect(verseNext.book).toBe(chapterNext.book);
    expect(verseNext.chapter).toBe(chapterNext.chapter);
  });

  it('prev verse chapter wrap matches getPrevNextChapter prev', () => {
    const { prev: chapterPrev } = getPrevNextChapter('John', 3);
    const versePrev = getPrevVerse('John', 3, 1);
    expect(versePrev.book).toBe(chapterPrev.book);
    expect(versePrev.chapter).toBe(chapterPrev.chapter);
  });
});