import { describe, it, expect } from 'vitest';
import { getPrevNextChapter, BIBLE_BOOKS } from './bibleBooks';

describe('getPrevNextChapter', () => {
  // ─── Bible wraparound ──────────────────────────────────────────────────────

  it('Genesis 1 prev wraps to Revelation 22', () => {
    const { prev } = getPrevNextChapter('Genesis', 1);
    expect(prev).toEqual({ book: 'Revelation', chapter: 22 });
  });

  it('Revelation 22 next wraps to Genesis 1', () => {
    const { next } = getPrevNextChapter('Revelation', 22);
    expect(next).toEqual({ book: 'Genesis', chapter: 1 });
  });

  // ─── Cross-book boundaries ────────────────────────────────────────────────

  it('Matthew 1 prev is Malachi 4', () => {
    const { prev } = getPrevNextChapter('Matthew', 1);
    expect(prev).toEqual({ book: 'Malachi', chapter: 4 });
  });

  it('Malachi 4 next is Matthew 1', () => {
    const { next } = getPrevNextChapter('Malachi', 4);
    expect(next).toEqual({ book: 'Matthew', chapter: 1 });
  });

  it('Genesis 50 next is Exodus 1', () => {
    const { next } = getPrevNextChapter('Genesis', 50);
    expect(next).toEqual({ book: 'Exodus', chapter: 1 });
  });

  it('Exodus 1 prev is Genesis 50', () => {
    const { prev } = getPrevNextChapter('Exodus', 1);
    expect(prev).toEqual({ book: 'Genesis', chapter: 50 });
  });

  // ─── Within-book navigation ────────────────────────────────────────────────

  it('Matthew 1 next is Matthew 2', () => {
    const { next } = getPrevNextChapter('Matthew', 1);
    expect(next).toEqual({ book: 'Matthew', chapter: 2 });
  });

  it('Matthew 2 prev is Matthew 1', () => {
    const { prev } = getPrevNextChapter('Matthew', 2);
    expect(prev).toEqual({ book: 'Matthew', chapter: 1 });
  });

  it('Psalms 3 prev is Psalms 2', () => {
    const { prev } = getPrevNextChapter('Psalms', 3);
    expect(prev).toEqual({ book: 'Psalms', chapter: 2 });
  });

  it('Psalms 3 next is Psalms 4', () => {
    const { next } = getPrevNextChapter('Psalms', 3);
    expect(next).toEqual({ book: 'Psalms', chapter: 4 });
  });

  // ─── Single-chapter books ──────────────────────────────────────────────────

  it('Obadiah 1 next is Jonah 1', () => {
    const { next } = getPrevNextChapter('Obadiah', 1);
    expect(next).toEqual({ book: 'Jonah', chapter: 1 });
  });

  it('Philemon 1 next is Hebrews 1', () => {
    const { next } = getPrevNextChapter('Philemon', 1);
    expect(next).toEqual({ book: 'Hebrews', chapter: 1 });
  });

  // ─── Consistency: every book/chapter round-trips ──────────────────────────

  it('next then prev always returns to the starting point', () => {
    for (const book of BIBLE_BOOKS) {
      for (const ch of [1, Math.ceil(book.chapters / 2), book.chapters]) {
        const { next } = getPrevNextChapter(book.name, ch);
        const { prev } = getPrevNextChapter(next.book, next.chapter);
        expect(prev).toEqual({ book: book.name, chapter: ch });
      }
    }
  });
});
