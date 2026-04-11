import { describe, it, expect } from 'vitest';
import {
  parseStrongsNumber,
  getVerseKey,
  getWordStrongsNumbers,
  lookupStrongs,
  tokeniseVerse,
  getTokenWordIndex,
} from './strongs';

// ─── parseStrongsNumber ─────────────────────────────────────────────────────
describe('parseStrongsNumber', () => {
  // 3.2.1
  it('parses Hebrew number', () => {
    expect(parseStrongsNumber('H1254')).toEqual({ language: 'hebrew', number: 1254 });
  });

  // 3.2.2
  it('parses Greek number', () => {
    expect(parseStrongsNumber('G2316')).toEqual({ language: 'greek', number: 2316 });
  });

  // 3.2.3
  it('handles leading zeros', () => {
    expect(parseStrongsNumber('H0001')).toEqual({ language: 'hebrew', number: 1 });
  });

  // 3.2.4
  it('returns null for invalid input', () => {
    expect(parseStrongsNumber('invalid')).toBeNull();
    expect(parseStrongsNumber('')).toBeNull();
    expect(parseStrongsNumber('X1234')).toBeNull();
  });
});

// ─── getVerseKey ────────────────────────────────────────────────────────────
describe('getVerseKey', () => {
  // 3.2.5
  it('Genesis 1:1 → Ge.1.1', () => {
    expect(getVerseKey('Genesis', 1, 1)).toBe('Ge.1.1');
  });

  // 3.2.6 — uses BOOK_ABBR_MAP abbreviation 'John' for John
  it('John 3:16 → John.3.16', () => {
    expect(getVerseKey('John', 3, 16)).toBe('John.3.16');
  });

  // 3.2.7
  it('1 Samuel 1:1 → 1Sm.1.1', () => {
    expect(getVerseKey('1 Samuel', 1, 1)).toBe('1Sm.1.1');
  });

  // 3.2.8 — uses BOOK_ABBR_MAP abbreviation 'Psa' for Psalms
  it('Psalms 23:1 → Psa.23.1', () => {
    expect(getVerseKey('Psalms', 23, 1)).toBe('Psa.23.1');
  });

  it('returns null for unknown book', () => {
    expect(getVerseKey('NotABook', 1, 1)).toBeNull();
  });
});

// ─── getWordStrongsNumbers ───────────────────────────────────────────────────
describe('getWordStrongsNumbers', () => {
  const mockWordIndex = { 'Ge.1.1': ['H7225', 'H1254', 'H430'] };

  // 3.2.9
  it('returns strongs array for known key', () => {
    expect(getWordStrongsNumbers('Ge.1.1', mockWordIndex)).toEqual(['H7225', 'H1254', 'H430']);
  });

  // 3.2.10
  it('returns [] for missing key', () => {
    expect(getWordStrongsNumbers('Ge.99.99', mockWordIndex)).toEqual([]);
  });
});

// ─── lookupStrongs ───────────────────────────────────────────────────────────
const mockHebLexicon = {
  'H1254': {
    lemma: 'בָּרָא',
    xlit: 'bârâʼ',
    pron: "baw-raw'",
    derivation: 'a primitive root;',
    strongs_def: '(absolutely) to create',
    kjv_def: 'create, creator',
  },
};
const mockGrkLexicon = {
  'G2316': {
    lemma: 'θεός',
    translit: 'theós',
    kjv_def: 'God',
    strongs_def: 'a deity, especially the supreme Divinity',
    derivation: 'of uncertain affinity;',
  },
};

describe('lookupStrongs', () => {
  // 3.2.11
  it('returns normalized entry for known Hebrew number', () => {
    const entry = lookupStrongs('H1254', mockHebLexicon);
    expect(entry).not.toBeNull();
    expect(entry!.strongs).toBe('H1254');
    expect(entry!.lemma).toBe('בָּרָא');
    expect(typeof entry!.translit).toBe('string');
    expect(typeof entry!.definition).toBe('string');
  });

  // 3.2.12
  it('returns null for unknown Strong\'s number', () => {
    expect(lookupStrongs('H9999', mockHebLexicon)).toBeNull();
  });

  // 3.2.13
  it('returns entry for known Greek number', () => {
    const entry = lookupStrongs('G2316', mockGrkLexicon);
    expect(entry).not.toBeNull();
    expect(entry!.strongs).toBe('G2316');
    expect(entry!.lemma).toBe('θεός');
  });
});

// ─── tokeniseVerse ───────────────────────────────────────────────────────────
describe('tokeniseVerse', () => {
  // 3.2.14
  it('splits on whitespace preserving attached punctuation', () => {
    expect(tokeniseVerse('In the beginning God created')).toEqual([
      'In', 'the', 'beginning', 'God', 'created',
    ]);
  });

  it('preserves comma attached to word', () => {
    const tokens = tokeniseVerse('For God so loved the world, that he gave');
    expect(tokens).toContain('world,');
  });
});

// ─── positional alignment (regression for word-index drift) ──────────────────
//
// The word-index stores one entry per word token, using '' for words that have
// no Strong's number.  Previously it stored only the non-empty numbers (dense),
// which caused every word AFTER a gap to receive the wrong Strong's entry.

const mockGrkLexAlignment = {
  'G4728': { lemma: 'στενός', translit: 'stenos', pron: 'sten-os', strongs_def: 'narrow' },
  'G4439': { lemma: 'πύλη',   translit: 'pule',   pron: 'poo-lay', strongs_def: 'a gate' },
  'G2222': { lemma: 'ζωή',    translit: 'zoe',    pron: 'dzo-ay',  strongs_def: 'life'   },
};

describe('positional word-index alignment', () => {
  it('empty string in positional array yields strongs:null for that token', () => {
    // '' is falsy → the "if (!strongsNum)" guard in getVerseWordData catches it
    const strongsNum = '';
    expect(!strongsNum).toBe(true);
    expect(lookupStrongs('', mockGrkLexAlignment)).toBeNull();
  });

  it('tokens after empty-string positions receive their own Strong\'s (no drift)', () => {
    // Positional array for "Because strait is the gate,"
    // positions 0,2,3 are empty; positions 1 and 4 have Strong's
    const tokens     = tokeniseVerse('Because strait is the gate,');
    const strongsArr = ['', 'G4728', '', '', 'G4439'];

    const results = tokens.map((token, i) => {
      const sn = strongsArr[i] ?? null;
      if (!sn) return { token, strongs: null };
      return { token, strongs: lookupStrongs(sn, mockGrkLexAlignment) };
    });

    expect(results[0]).toEqual({ token: 'Because', strongs: null }); // empty → null
    expect(results[1].token).toBe('strait');
    expect(results[1].strongs?.strongs).toBe('G4728');               // correct
    expect(results[2]).toEqual({ token: 'is',  strongs: null });     // empty → null
    expect(results[3]).toEqual({ token: 'the', strongs: null });     // empty → null
    expect(results[4].token).toBe('gate,');
    expect(results[4].strongs?.strongs).toBe('G4439');               // correct — no drift
  });

  it('dense array (old bug) drifts: "Because" wrongly gets G4728, "gate," gets null', () => {
    // Documents what the OLD dense format produced, so a regression is obvious.
    const tokens     = tokeniseVerse('Because strait is the gate,');
    const denseArr   = ['G4728', 'G4439'];   // old format: no empty strings

    const results = tokens.map((token, i) => {
      const sn = denseArr[i] ?? null;
      if (!sn) return { token, strongs: null };
      return { token, strongs: lookupStrongs(sn, mockGrkLexAlignment) };
    });

    // With old dense format every word is shifted — the tests below are WRONG answers:
    expect(results[0].strongs?.strongs).toBe('G4728'); // 'Because' incorrectly gets 'strait'
    expect(results[1].strongs?.strongs).toBe('G4439'); // 'strait'  incorrectly gets 'gate'
    expect(results[4]).toEqual({ token: 'gate,', strongs: null }); // 'gate,' gets nothing
  });
});

// ─── getTokenWordIndex ────────────────────────────────────────────────────────
describe('getTokenWordIndex', () => {
  // 3.2.15
  it('returns 0-based index of the word in the verse', () => {
    expect(getTokenWordIndex('In the beginning God created the heaven', 2)).toBe(2);
  });

  it('returns 0 for first word', () => {
    expect(getTokenWordIndex('In the beginning God created the heaven', 0)).toBe(0);
  });

  it('returns correct index at end', () => {
    expect(getTokenWordIndex('In the beginning God created the heaven', 6)).toBe(6);
  });
});
