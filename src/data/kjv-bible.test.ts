import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseKJVLine, BOOK_ABBR_MAP, parseKJVBible, getKJVChapter, getKJVVerse, _setBibleForTesting } from './kjv-bible';

// Load real kjv.txt once for live-data tests
const KJV_RAW = readFileSync(join(__dirname, '../../kjv.txt'), 'utf-8');

describe('parseKJVLine', () => {
  it('parses a simple OT verse', () => {
    const result = parseKJVLine('Ge1:1 In the beginning God created the heaven and the earth.');
    expect(result).toEqual({
      abbr: 'Ge',
      chapter: 1,
      verse: 1,
      text: 'In the beginning God created the heaven and the earth.',
    });
  });

  it('parses a numbered-prefix book', () => {
    const result = parseKJVLine('1Sm1:1 Now there was a certain man of Ramathaimzophim.');
    expect(result).toEqual({ abbr: '1Sm', chapter: 1, verse: 1, text: 'Now there was a certain man of Ramathaimzophim.' });
  });

  it('parses a double-letter prefix numbered book', () => {
    const result = parseKJVLine('1Chr10:1 Now the Philistines fought against Israel.');
    expect(result).toEqual({ abbr: '1Chr', chapter: 10, verse: 1, text: 'Now the Philistines fought against Israel.' });
  });

  it('parses Song of Solomon', () => {
    const result = parseKJVLine('SSol1:1 The song of songs, which is Solomon\'s.');
    expect(result).toEqual({ abbr: 'SSol', chapter: 1, verse: 1, text: 'The song of songs, which is Solomon\'s.' });
  });

  it('parses a NT verse with multi-digit chapter and verse', () => {
    const result = parseKJVLine('John3:16 For God so loved the world.');
    expect(result).toEqual({ abbr: 'John', chapter: 3, verse: 16, text: 'For God so loved the world.' });
  });

  it('parses Psalms 119:105', () => {
    const result = parseKJVLine('Psa119:105 Thy word is a lamp unto my feet.');
    expect(result).toEqual({ abbr: 'Psa', chapter: 119, verse: 105, text: 'Thy word is a lamp unto my feet.' });
  });

  it('returns null for the file header', () => {
    expect(parseKJVLine('Holy Bible, Authorized (King James) Version, Textfile 930105.')).toBeNull();
  });

  it('returns null for blank lines', () => {
    expect(parseKJVLine('')).toBeNull();
    expect(parseKJVLine('   ')).toBeNull();
  });
});

describe('BOOK_ABBR_MAP', () => {
  it('has all 66 books', () => {
    expect(Object.keys(BOOK_ABBR_MAP).length).toBe(66);
  });

  it('maps Ge to Genesis (OT)', () => {
    expect(BOOK_ABBR_MAP['Ge'].name).toBe('Genesis');
    expect(BOOK_ABBR_MAP['Ge'].testament).toBe('old');
  });

  it('maps Mat to Matthew (NT)', () => {
    expect(BOOK_ABBR_MAP['Mat'].name).toBe('Matthew');
    expect(BOOK_ABBR_MAP['Mat'].testament).toBe('new');
  });

  it('maps Rev to Revelation', () => {
    expect(BOOK_ABBR_MAP['Rev'].name).toBe('Revelation');
    expect(BOOK_ABBR_MAP['Rev'].testament).toBe('new');
  });

  it('maps 1Sm to 1 Samuel', () => {
    expect(BOOK_ABBR_MAP['1Sm'].name).toBe('1 Samuel');
  });

  it('maps SSol to Song of Solomon', () => {
    expect(BOOK_ABBR_MAP['SSol'].name).toBe('Song of Solomon');
  });

  it('books are in canonical order (Ge=1, Rev=66)', () => {
    expect(BOOK_ABBR_MAP['Ge'].order).toBe(1);
    expect(BOOK_ABBR_MAP['Rev'].order).toBe(66);
  });
});

describe('parseKJVBible', () => {
  const SAMPLE = `Holy Bible, Authorized (King James) Version, Textfile 930105.
Ge1:1 In the beginning God created the heaven and the earth.
Ge1:2 And the earth was without form, and void.
Ge2:1 Thus the heavens and the earth were finished.
John3:16 For God so loved the world, that he gave his only begotten Son.
John3:17 For God sent not his Son into the world to condemn the world.
`;

  it('parses sample text into nested map', () => {
    const bible = parseKJVBible(SAMPLE);
    expect(bible.has('Genesis')).toBe(true);
    expect(bible.get('Genesis')!.has(1)).toBe(true);
    expect(bible.get('Genesis')!.get(1)!.length).toBe(2);
    expect(bible.get('Genesis')!.get(1)![0].text).toBe('In the beginning God created the heaven and the earth.');
  });

  it('organises chapters correctly', () => {
    const bible = parseKJVBible(SAMPLE);
    expect(bible.get('Genesis')!.has(2)).toBe(true);
    expect(bible.get('Genesis')!.get(2)![0].verse).toBe(1);
  });

  it('builds correct reference string', () => {
    const bible = parseKJVBible(SAMPLE);
    const john3 = bible.get('John')!.get(3)!;
    expect(john3[0].reference).toBe('John 3:16');
    expect(john3[1].reference).toBe('John 3:17');
  });
});

describe('getKJVChapter / getKJVVerse (live data)', () => {
  beforeAll(() => {
    _setBibleForTesting(KJV_RAW);
  });

  it('returns verses for Genesis 1', async () => {
    const verses = await getKJVChapter('Genesis', 1);
    expect(verses.length).toBeGreaterThan(20);
    expect(verses[0].text).toContain('beginning');
    expect(verses[0].reference).toBe('Genesis 1:1');
  });

  it('returns verse by reference', async () => {
    const verse = await getKJVVerse('John 3:16');
    expect(verse).not.toBeNull();
    expect(verse!.text).toContain('God so loved');
  });

  it('returns null for unknown reference', async () => {
    expect(await getKJVVerse('Unknown 99:99')).toBeNull();
  });

  it('returns verses for Psalms 119', async () => {
    const verses = await getKJVChapter('Psalms', 119);
    expect(verses.length).toBe(176);
  });
});
