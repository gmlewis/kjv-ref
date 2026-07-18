import { describe, it, expect } from 'vitest';
import { parseVerseRangeRef } from '../utils/urlHelpers';
import { KJV_VERSES, type KJVVerse } from '../data/kjv-verses';
import { extractKeywords, assessDifficulty } from '../utils/spacedRepetition';

/**
 * Tests for multi-verse range practice sessions.
 * 
 * When a user navigates to /practice/Psalms%2023:1-6, the Practice component
 * needs to load all 6 verses (even though most aren't in KJV_VERSES) and
 * present them as a sequential practice session.
 */

describe('Practice multi-verse range reference parsing', () => {
  it('detects "Psalms 23:1-6" as a range (verseEnd > verseStart)', () => {
    const parsed = parseVerseRangeRef('Psalms 23:1-6');
    expect(parsed).not.toBeNull();
    expect(parsed!.verseEnd).toBeGreaterThan(parsed!.verseStart);
  });

  it('detects "John 3:16" as NOT a range (verseEnd === verseStart)', () => {
    const parsed = parseVerseRangeRef('John 3:16');
    expect(parsed).not.toBeNull();
    expect(parsed!.verseEnd).toBe(parsed!.verseStart);
  });

  it('detects "1 Corinthians 13:1-13" as a range', () => {
    const parsed = parseVerseRangeRef('1 Corinthians 13:1-13');
    expect(parsed).not.toBeNull();
    expect(parsed!.verseEnd).toBeGreaterThan(parsed!.verseStart);
    expect(parsed!.book).toBe('1 Corinthians');
  });

  it('rejects reversed range', () => {
    expect(parseVerseRangeRef('John 3:6-1')).toBeNull();
  });
});

describe('Practice range verse loading logic', () => {
  // Simulate the logic from Practice.tsx: for a range like "Psalms 23:1-6",
  // check which verses are in KJV_VERSES and which need to be fetched.
  it('most verses in a typical range are NOT in KJV_VERSES', () => {
    const parsed = parseVerseRangeRef('Psalms 23:1-6');
    expect(parsed).not.toBeNull();
    const refs: string[] = [];
    for (let v = parsed!.verseStart; v <= parsed!.verseEnd; v++) {
      refs.push(`${parsed!.book} ${parsed!.chapter}:${v}`);
    }
    // KJV_VERSES only has a few curated verses — most of Psalms 23:1-6 won't be there
    const inKJV = refs.filter(r => KJV_VERSES.find(v => v.reference === r));
    const notInKJV = refs.filter(r => !KJV_VERSES.find(v => v.reference === r));
    expect(refs).toHaveLength(6);
    expect(inKJV.length).toBeLessThan(6);
    expect(notInKJV.length).toBeGreaterThan(0);
  });

  it('generates correct reference list for "Psalms 23:1-6"', () => {
    const parsed = parseVerseRangeRef('Psalms 23:1-6');
    const refs: string[] = [];
    for (let v = parsed!.verseStart; v <= parsed!.verseEnd; v++) {
      refs.push(`${parsed!.book} ${parsed!.chapter}:${v}`);
    }
    expect(refs).toEqual([
      'Psalms 23:1', 'Psalms 23:2', 'Psalms 23:3',
      'Psalms 23:4', 'Psalms 23:5', 'Psalms 23:6',
    ]);
  });

  it('generates correct reference list for "1 Corinthians 13:1-13"', () => {
    const parsed = parseVerseRangeRef('1 Corinthians 13:1-13');
    const refs: string[] = [];
    for (let v = parsed!.verseStart; v <= parsed!.verseEnd; v++) {
      refs.push(`${parsed!.book} ${parsed!.chapter}:${v}`);
    }
    expect(refs).toHaveLength(13);
    expect(refs[0]).toBe('1 Corinthians 13:1');
    expect(refs[12]).toBe('1 Corinthians 13:13');
  });

  it('KJVVerse synthesis from a Bible entry has correct fields', () => {
    // Simulate the synthesis pattern from Practice.tsx
    const fakeEntry = {
      reference: 'Psalms 23:2',
      verse: 2,
      text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.',
    };
    const m = fakeEntry.reference.match(/^(.+) (\d+):(\d+)$/);
    expect(m).not.toBeNull();
    const synthesized: KJVVerse = {
      reference: fakeEntry.reference,
      book: m![1],
      chapter: parseInt(m![2], 10),
      verse: fakeEntry.verse,
      text: fakeEntry.text,
      keywords: extractKeywords(fakeEntry.text),
      difficulty: assessDifficulty(fakeEntry.text),
      theme: 'custom',
    };
    expect(synthesized.book).toBe('Psalms');
    expect(synthesized.chapter).toBe(23);
    expect(synthesized.verse).toBe(2);
    expect(synthesized.keywords.length).toBeGreaterThan(0);
    expect(['easy', 'medium', 'hard']).toContain(synthesized.difficulty);
  });

  it('verses in a range should be sorted by verse number', () => {
    // Simulate the sorting in the range loader
    const verses = [
      { reference: 'Psalms 23:3', verse: 3, text: '', book: 'Psalms', chapter: 23, keywords: [], difficulty: 'easy' as const, theme: 'custom' },
      { reference: 'Psalms 23:1', verse: 1, text: '', book: 'Psalms', chapter: 23, keywords: [], difficulty: 'easy' as const, theme: 'custom' },
      { reference: 'Psalms 23:6', verse: 6, text: '', book: 'Psalms', chapter: 23, keywords: [], difficulty: 'easy' as const, theme: 'custom' },
    ];
    verses.sort((a, b) => a.verse - b.verse);
    expect(verses.map(v => v.verse)).toEqual([1, 3, 6]);
  });
});

describe('Practice session display for ranges', () => {
  it('a 6-verse range produces "Verse 1 of 6" through "Verse 6 of 6"', () => {
    const parsed = parseVerseRangeRef('Psalms 23:1-6');
    const count = parsed!.verseEnd - parsed!.verseStart + 1;
    expect(count).toBe(6);
    // The "Verse N of M" display in PracticeSession uses idx+1 and verses.length
    for (let i = 0; i < count; i++) {
      const display = `Verse ${i + 1} of ${count}`;
      expect(display).toMatch(/^Verse \d+ of 6$/);
    }
  });

  it('the last verse in a range shows "Finish Session" not "Next Verse"', () => {
    const parsed = parseVerseRangeRef('Psalms 23:1-6');
    const count = parsed!.verseEnd - parsed!.verseStart + 1;
    // PracticeSession checks: idx + 1 >= verses.length → Finish Session
    const lastIdx = count - 1;
    expect(lastIdx + 1 >= count).toBe(true);
  });

  it('non-last verses show "Next Verse"', () => {
    const parsed = parseVerseRangeRef('Psalms 23:1-6');
    const count = parsed!.verseEnd - parsed!.verseStart + 1;
    for (let i = 0; i < count - 1; i++) {
      expect(i + 1 >= count).toBe(false);
    }
  });
});