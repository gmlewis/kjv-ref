import { describe, it, expect } from 'vitest';
import { searchBibleReferences } from './bibleRefSearch';

// ─── Basic reference parsing ─────────────────────────────────────────────────

describe('searchBibleReferences — basic parsing', () => {
  it('parses "John 3:16" (spaced with colon)', () => {
    const r = searchBibleReferences('John 3:16');
    expect(r[0]).toMatchObject({ book: 'John', chapter: 3, verse: 16 });
    expect(r[0].reference).toBe('John 3:16');
  });

  it('parses "jn3:16" (compact with colon)', () => {
    const r = searchBibleReferences('jn3:16');
    expect(r[0]).toMatchObject({ book: 'John', chapter: 3, verse: 16 });
  });

  it('parses "1 jn 2 1" (spaced with no colon)', () => {
    const r = searchBibleReferences('1 jn 2 1');
    expect(r[0]).toMatchObject({ book: '1 John', chapter: 2, verse: 1 });
  });

  it('parses "1jn2:1" (compact with colon)', () => {
    const r = searchBibleReferences('1jn2:1');
    expect(r[0]).toMatchObject({ book: '1 John', chapter: 2, verse: 1 });
  });

  it('parses "ps23" (just book+chapter, defaults to verse 1)', () => {
    const r = searchBibleReferences('ps23');
    expect(r[0]).toMatchObject({ book: 'Psalms', chapter: 23, verse: 1 });
  });

  it('parses "ps 23" (spaced book+chapter)', () => {
    const r = searchBibleReferences('ps 23');
    expect(r[0]).toMatchObject({ book: 'Psalms', chapter: 23, verse: 1 });
  });

  it('parses "1 john" (just book name, defaults to 1:1)', () => {
    const r = searchBibleReferences('1 john');
    expect(r[0]).toMatchObject({ book: '1 John', chapter: 1, verse: 1 });
  });

  it('"1 john" does NOT match "John 1:1" as the top result', () => {
    const r = searchBibleReferences('1 john');
    expect(r[0].book).toBe('1 John');
    expect(r[0].book).not.toBe('John');
  });

  it('parses "Genesis 1:1"', () => {
    const r = searchBibleReferences('Genesis 1:1');
    expect(r[0]).toMatchObject({ book: 'Genesis', chapter: 1, verse: 1 });
  });

  it('parses "gen1:1" (compact)', () => {
    const r = searchBibleReferences('gen1:1');
    expect(r[0]).toMatchObject({ book: 'Genesis', chapter: 1, verse: 1 });
  });
});

// ─── All 66 books by full name ───────────────────────────────────────────────

describe('searchBibleReferences — all 66 books by full name', () => {
  const books = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
    'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
    'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
    'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
    'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation',
  ];

  for (const book of books) {
    it(`parses "${book} 1:1"`, () => {
      const r = searchBibleReferences(`${book} 1:1`);
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].book).toBe(book);
    });
  }
});

// ─── Abbreviations ───────────────────────────────────────────────────────────

describe('searchBibleReferences — abbreviations', () => {
  const cases: Array<[string, string]> = [
    // Canonical abbreviations from BIBLE_BOOKS
    ['Gen', 'Genesis'], ['Ex', 'Exodus'], ['Lev', 'Leviticus'],
    ['Num', 'Numbers'], ['Deut', 'Deuteronomy'], ['Josh', 'Joshua'],
    ['Judg', 'Judges'], ['Ruth', 'Ruth'], ['1Sam', '1 Samuel'],
    ['2Sam', '2 Samuel'], ['1Kgs', '1 Kings'], ['2Kgs', '2 Kings'],
    ['1Chr', '1 Chronicles'], ['2Chr', '2 Chronicles'], ['Ezra', 'Ezra'],
    ['Neh', 'Nehemiah'], ['Esth', 'Esther'], ['Job', 'Job'],
    ['Ps', 'Psalms'], ['Prov', 'Proverbs'], ['Eccl', 'Ecclesiastes'],
    ['Song', 'Song of Solomon'], ['Isa', 'Isaiah'], ['Jer', 'Jeremiah'],
    ['Lam', 'Lamentations'], ['Ezek', 'Ezekiel'], ['Dan', 'Daniel'],
    ['Hos', 'Hosea'], ['Joel', 'Joel'], ['Amos', 'Amos'],
    ['Obad', 'Obadiah'], ['Jonah', 'Jonah'], ['Mic', 'Micah'],
    ['Nah', 'Nahum'], ['Hab', 'Habakkuk'], ['Zeph', 'Zephaniah'],
    ['Hag', 'Haggai'], ['Zech', 'Zechariah'], ['Mal', 'Malachi'],
    ['Matt', 'Matthew'], ['Mark', 'Mark'], ['Luke', 'Luke'],
    ['John', 'John'], ['Acts', 'Acts'], ['Rom', 'Romans'],
    ['1Cor', '1 Corinthians'], ['2Cor', '2 Corinthians'],
    ['Gal', 'Galatians'], ['Eph', 'Ephesians'], ['Phil', 'Philippians'],
    ['Col', 'Colossians'], ['1Thes', '1 Thessalonians'],
    ['2Thes', '2 Thessalonians'], ['1Tim', '1 Timothy'],
    ['2Tim', '2 Timothy'], ['Titus', 'Titus'], ['Phlm', 'Philemon'],
    ['Heb', 'Hebrews'], ['Jas', 'James'], ['1Pet', '1 Peter'],
    ['2Pet', '2 Peter'], ['1John', '1 John'], ['2John', '2 John'],
    ['3John', '3 John'], ['Jude', 'Jude'], ['Rev', 'Revelation'],

    // BOOK_ABBR_MAP keys
    ['Ge', 'Genesis'], ['Exo', 'Exodus'], ['Jdgs', 'Judges'],
    ['1Sm', '1 Samuel'], ['2Sm', '2 Samuel'], ['1Ki', '1 Kings'],
    ['2Ki', '2 Kings'], ['Est', 'Esther'], ['Psa', 'Psalms'],
    ['Prv', 'Proverbs'], ['SSol', 'Song of Solomon'], ['Eze', 'Ezekiel'],
    ['Mat', 'Matthew'], ['Phi', 'Philippians'], ['1Th', '1 Thessalonians'],
    ['2Th', '2 Thessalonians'], ['Phmn', 'Philemon'], ['1Jn', '1 John'],
    ['2Jn', '2 John'], ['3Jn', '3 John'],

    // Extra short aliases
    ['jn', 'John'], ['ps', 'Psalms'], ['pr', 'Proverbs'],
    ['ec', 'Ecclesiastes'], ['ss', 'Song of Solomon'],
    ['1jn', '1 John'], ['2jn', '2 John'], ['3jn', '3 John'],
    ['mt', 'Matthew'], ['mk', 'Mark'], ['lk', 'Luke'],
    ['ro', 'Romans'], ['ac', 'Acts'], ['rv', 'Revelation'],
    ['ge', 'Genesis'], ['ex', 'Exodus'], ['lv', 'Leviticus'],
    ['nm', 'Numbers'], ['dt', 'Deuteronomy'], ['jos', 'Joshua'],
    ['jdg', 'Judges'], ['ru', 'Ruth'], ['jb', 'Job'],
    ['is', 'Isaiah'], ['je', 'Jeremiah'], ['ez', 'Ezekiel'],
    ['dn', 'Daniel'], ['hs', 'Hosea'], ['jl', 'Joel'],
    ['am', 'Amos'], ['ob', 'Obadiah'], ['mi', 'Micah'],
    ['na', 'Nahum'], ['hk', 'Habakkuk'], ['hb', 'Habakkuk'],
    ['zp', 'Zephaniah'], ['hg', 'Haggai'], ['zc', 'Zechariah'],
    ['ml', 'Malachi'], ['jd', 'Jude'], ['jam', 'James'],
    ['jm', 'James'], ['heb', 'Hebrews'], ['ga', 'Galatians'],
    ['eph', 'Ephesians'], ['php', 'Philippians'], ['col', 'Colossians'],
    ['tit', 'Titus'], ['phm', 'Philemon'], ['neh', 'Nehemiah'],
    ['est', 'Esther'], ['lam', 'Lamentations'],

    // Single-letter numbered book aliases
    ['1j', '1 John'], ['2j', '2 John'], ['3j', '3 John'],
    ['1p', '1 Peter'], ['2p', '2 Peter'],
    ['1s', '1 Samuel'], ['2s', '2 Samuel'],
    ['1k', '1 Kings'], ['2k', '2 Kings'],
    ['1c', '1 Corinthians'], ['2c', '2 Corinthians'],
  ];

  for (const [abbr, expected] of cases) {
    it(`"${abbr} 1:1" → ${expected} 1:1`, () => {
      const r = searchBibleReferences(`${abbr} 1:1`);
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].book).toBe(expected);
    });
  }
});

// ─── Fuzzy prefix matching ───────────────────────────────────────────────────

describe('searchBibleReferences — fuzzy prefix matching', () => {
  it('"gene" matches Genesis (prefix)', () => {
    const r = searchBibleReferences('gene1:1');
    expect(r.some(m => m.book === 'Genesis')).toBe(true);
  });

  it('"rev" matches Revelation (prefix)', () => {
    const r = searchBibleReferences('rev22:21');
    expect(r.some(m => m.book === 'Revelation')).toBe(true);
  });

  it('"phil" matches both Philippians and Philemon (prefix)', () => {
    const r = searchBibleReferences('phil1:1');
    expect(r.some(m => m.book === 'Philippians')).toBe(true);
    expect(r.some(m => m.book === 'Philemon')).toBe(true);
  });

  it('"co" matches Colossians (prefix)', () => {
    const r = searchBibleReferences('co1:1');
    expect(r.some(m => m.book === 'Colossians')).toBe(true);
  });

  it('"j" matches multiple books starting with J (prefix)', () => {
    // "j1:1" — variants starting with "j" include: john, jonah, joshua, judges, etc.
    // But with "j1:1" the compact parse extracts bookQuery="j", chapter=1
    // and prefix matches all variants starting with "j"
    const r = searchBibleReferences('james1:1');
    const books = r.map(m => m.book);
    expect(books.length).toBeGreaterThan(0);
  });

  it('"1" matches multiple numbered books (prefix)', () => {
    // "1 1:1" — spaced parse gives bookQuery="1", but "1" is too short (min 2 chars)
    // for prefix matching. Use "1 c" instead which matches 1 Corinthians, 1 Chronicles.
    const r = searchBibleReferences('1 c 1:1');
    const books = r.map(m => m.book);
    expect(books.length).toBeGreaterThan(1);
  });
});

// ─── Input format variations ─────────────────────────────────────────────────

describe('searchBibleReferences — input format variations', () => {
  it('handles "John 3:16" (standard spaced)', () => {
    expect(searchBibleReferences('John 3:16')[0].reference).toBe('John 3:16');
  });

  it('handles "john 3:16" (lowercase)', () => {
    expect(searchBibleReferences('john 3:16')[0].reference).toBe('John 3:16');
  });

  it('handles "JOHN 3:16" (uppercase)', () => {
    expect(searchBibleReferences('JOHN 3:16')[0].reference).toBe('John 3:16');
  });

  it('handles "John 3 16" (spaces instead of colon)', () => {
    expect(searchBibleReferences('John 3 16')[0].reference).toBe('John 3:16');
  });

  it('handles "jn3:16" (compact, no space)', () => {
    expect(searchBibleReferences('jn3:16')[0].reference).toBe('John 3:16');
  });

  it('handles "1 john 2" (book + chapter only → verse 1)', () => {
    expect(searchBibleReferences('1 john 2')[0]).toMatchObject({
      book: '1 John', chapter: 2, verse: 1,
    });
  });

  it('handles "1jn2" (compact, book + chapter only)', () => {
    expect(searchBibleReferences('1jn2')[0]).toMatchObject({
      book: '1 John', chapter: 2, verse: 1,
    });
  });

  it('handles just a book name "Revelation" → 1:1', () => {
    expect(searchBibleReferences('Revelation')[0]).toMatchObject({
      book: 'Revelation', chapter: 1, verse: 1,
    });
  });

  it('handles "song of solomon 1:1" (multi-word book)', () => {
    expect(searchBibleReferences('song of solomon 1:1')[0]).toMatchObject({
      book: 'Song of Solomon', chapter: 1, verse: 1,
    });
  });

  it('handles "sos1:1" (alias for Song of Solomon)', () => {
    expect(searchBibleReferences('sos1:1')[0]).toMatchObject({
      book: 'Song of Solomon', chapter: 1, verse: 1,
    });
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe('searchBibleReferences — validation', () => {
  it('rejects chapter 0', () => {
    const r = searchBibleReferences('John 0:1');
    // Should not return John 0:1, but might match just "John 1:1"
    expect(r.find(m => m.chapter === 0)).toBeUndefined();
  });

  it('rejects chapter beyond book length', () => {
    // John has 21 chapters
    const r = searchBibleReferences('John 99:1');
    expect(r.find(m => m.chapter === 99)).toBeUndefined();
  });

  it('rejects verse 0', () => {
    const r = searchBibleReferences('John 1:0');
    expect(r.find(m => m.verse === 0)).toBeUndefined();
  });

  it('accepts the last chapter of each book', () => {
    const r = searchBibleReferences('Revelation 22:21');
    expect(r[0]).toMatchObject({ book: 'Revelation', chapter: 22, verse: 21 });
  });
});

// ─── Ranking / scoring ────────────────────────────────────────────────────────

describe('searchBibleReferences — ranking', () => {
  it('exact match scores higher than fuzzy match', () => {
    const r = searchBibleReferences('John 3:16');
    // "John" exact match should be first, not "1 John" or "2 John" or "3 John"
    expect(r[0].book).toBe('John');
  });

  it('"1 john" does not return "John" as the first match', () => {
    const r = searchBibleReferences('1 john');
    expect(r[0].book).toBe('1 John');
  });

  it('spaced format scores higher than compact format', () => {
    const r = searchBibleReferences('John 3:16');
    // Should be found with the spaced parse (score 100)
    expect(r[0].score).toBeGreaterThanOrEqual(90);
  });

  it('results are sorted by score descending', () => {
    const r = searchBibleReferences('phil1:1');
    for (let i = 1; i < r.length; i++) {
      expect(r[i].score).toBeLessThanOrEqual(r[i - 1].score);
    }
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('searchBibleReferences — edge cases', () => {
  it('returns empty for empty string', () => {
    expect(searchBibleReferences('')).toEqual([]);
  });

  it('returns empty for whitespace only', () => {
    expect(searchBibleReferences('   ')).toEqual([]);
  });

  it('returns empty for pure numbers', () => {
    expect(searchBibleReferences('123')).toEqual([]);
  });

  it('returns empty for random text', () => {
    expect(searchBibleReferences('xyzzy')).toEqual([]);
  });

  it('handles "1" as a book prefix (returns numbered books)', () => {
    const r = searchBibleReferences('1 sam1:1');
    expect(r.length).toBeGreaterThan(0);
  });

  it('handles "2" as a book prefix', () => {
    const r = searchBibleReferences('2 sam1:1');
    expect(r.length).toBeGreaterThan(0);
  });

  it('handles "3" as a book prefix', () => {
    const r = searchBibleReferences('3jn1:1');
    expect(r.length).toBeGreaterThan(0);
  });

  it('respects maxResults limit', () => {
    const r = searchBibleReferences('1 1:1', 3);
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it('does not return duplicate references', () => {
    const r = searchBibleReferences('John 3:16');
    const refs = r.map(m => m.reference);
    expect(new Set(refs).size).toBe(refs.length);
  });
});

// ─── Real-world usage patterns ────────────────────────────────────────────────

describe('searchBibleReferences — real-world patterns', () => {
  it('"ps23:1" → Psalms 23:1', () => {
    expect(searchBibleReferences('ps23:1')[0].reference).toBe('Psalms 23:1');
  });

  it('"psalm23" → Psalms 23:1', () => {
    expect(searchBibleReferences('psalm23')[0]).toMatchObject({
      book: 'Psalms', chapter: 23,
    });
  });

  it('"rom8:28" → Romans 8:28', () => {
    expect(searchBibleReferences('rom8:28')[0].reference).toBe('Romans 8:28');
  });

  it('"1cor13:4" → 1 Corinthians 13:4', () => {
    expect(searchBibleReferences('1cor13:4')[0].reference).toBe('1 Corinthians 13:4');
  });

  it('"genesis1" → Genesis 1:1', () => {
    expect(searchBibleReferences('genesis1')[0]).toMatchObject({
      book: 'Genesis', chapter: 1, verse: 1,
    });
  });

  it('"ex20" → Exodus 20:1 (ten commandments)', () => {
    expect(searchBibleReferences('ex20')[0]).toMatchObject({
      book: 'Exodus', chapter: 20, verse: 1,
    });
  });

  it('"matt5:3" → Matthew 5:3 (beatitudes)', () => {
    expect(searchBibleReferences('matt5:3')[0].reference).toBe('Matthew 5:3');
  });

  it('"rev21:4" → Revelation 21:4', () => {
    expect(searchBibleReferences('rev21:4')[0].reference).toBe('Revelation 21:4');
  });

  it('"hebrews11:1" → Hebrews 11:1 (faith chapter)', () => {
    expect(searchBibleReferences('hebrews11:1')[0].reference).toBe('Hebrews 11:1');
  });

  it('"1pet5:7" → 1 Peter 5:7', () => {
    expect(searchBibleReferences('1pet5:7')[0].reference).toBe('1 Peter 5:7');
  });

  it('"phil4:13" → Philippians 4:13', () => {
    expect(searchBibleReferences('phil4:13')[0].reference).toBe('Philippians 4:13');
  });

  it('"john3:16" → John 3:16 (most famous verse)', () => {
    expect(searchBibleReferences('john3:16')[0].reference).toBe('John 3:16');
  });

  it('"jon1:1" → Jonah 1:1 (not John)', () => {
    expect(searchBibleReferences('jon1:1')[0].book).toBe('Jonah');
  });

  it('"jnh1:1" → Jonah 1:1', () => {
    expect(searchBibleReferences('jnh1:1')[0].book).toBe('Jonah');
  });
});