// Fuzzy Bible reference parser.
// Takes free-form input like "jn3:16", "1 jn 2 1", "ps23", "1 john" and
// returns ranked matches with book/chapter/verse.

import { BIBLE_BOOKS, type BibleBook } from './bibleBooks';
import { BOOK_ABBR_MAP } from '../data/kjv-bible';

export interface BibleRefMatch {
  book: string;
  chapter: number;
  verse: number;
  verseEnd?: number;
  reference: string;
  score: number;
}

// ─── Book name lookup table ──────────────────────────────────────────────────

const BOOK_VARIANTS: Map<string, string> = new Map();

function addVariant(variant: string, bookName: string) {
  const key = variant.toLowerCase().replace(/\s/g, '');
  if (!BOOK_VARIANTS.has(key)) BOOK_VARIANTS.set(key, bookName);
}

for (const b of BIBLE_BOOKS) {
  addVariant(b.name, b.name);
  addVariant(b.abbr, b.name);
}
for (const [abbr, info] of Object.entries(BOOK_ABBR_MAP)) {
  addVariant(abbr, info.name);
}

// Common short aliases not covered by the above
const EXTRA_ALIASES: Array<[string, string]> = [
  // Common short aliases users might type, beyond the canonical abbreviations
  // already registered from BIBLE_BOOKS.abbr and BOOK_ABBR_MAP.
  ['jn', 'John'], ['jnh', 'Jonah'], ['jon', 'Jonah'],
  ['ps', 'Psalms'], ['psa', 'Psalms'], ['pslm', 'Psalms'],
  ['pr', 'Proverbs'], ['prv', 'Proverbs'], ['prov', 'Proverbs'],
  ['ec', 'Ecclesiastes'], ['ecc', 'Ecclesiastes'],
  ['ss', 'Song of Solomon'], ['sg', 'Song of Solomon'], ['sos', 'Song of Solomon'],
  ['sn', 'Song of Solomon'],
  ['1jn', '1 John'], ['2jn', '2 John'], ['3jn', '3 John'],
  ['1jo', '1 John'], ['2jo', '2 John'], ['3jo', '3 John'],
  ['1j', '1 John'], ['2j', '2 John'], ['3j', '3 John'],
  ['1pet', '1 Peter'], ['2pet', '2 Peter'],
  ['1pe', '1 Peter'], ['2pe', '2 Peter'],
  ['1p', '1 Peter'], ['2p', '2 Peter'],
  ['1th', '1 Thessalonians'], ['2th', '2 Thessalonians'],
  ['1thes', '1 Thessalonians'], ['2thes', '2 Thessalonians'],
  ['1thes', '1 Thessalonians'], ['2thes', '2 Thessalonians'],
  ['1tim', '1 Timothy'], ['2tim', '2 Timothy'],
  ['1ti', '1 Timothy'], ['2ti', '2 Timothy'],
  ['1cor', '1 Corinthians'], ['2cor', '2 Corinthians'],
  ['1co', '1 Corinthians'], ['2co', '2 Corinthians'],
  ['1c', '1 Corinthians'], ['2c', '2 Corinthians'],
  ['1sam', '1 Samuel'], ['2sam', '2 Samuel'],
  ['1sa', '1 Samuel'], ['2sa', '2 Samuel'],
  ['1s', '1 Samuel'], ['2s', '2 Samuel'],
  ['1ki', '1 Kings'], ['2ki', '2 Kings'],
  ['1kg', '1 Kings'], ['2kg', '2 Kings'],
  ['1k', '1 Kings'], ['2k', '2 Kings'],
  ['1chr', '1 Chronicles'], ['2chr', '2 Chronicles'],
  ['1ch', '1 Chronicles'], ['2ch', '2 Chronicles'],
  ['1cr', '1 Chronicles'], ['2cr', '2 Chronicles'],
  ['mt', 'Matthew'], ['mk', 'Mark'], ['lk', 'Luke'],
  ['ro', 'Romans'], ['ac', 'Acts'], ['rv', 'Revelation'],
  ['rev', 'Revelation'], ['re', 'Revelation'],
  ['jam', 'James'], ['jm', 'James'], ['ja', 'James'],
  ['heb', 'Hebrews'],
  ['ge', 'Genesis'], ['ex', 'Exodus'], ['lv', 'Leviticus'],
  ['nm', 'Numbers'], ['dt', 'Deuteronomy'],
  ['jos', 'Joshua'], ['jdg', 'Judges'],
  ['ru', 'Ruth'], ['jb', 'Job'],
  ['is', 'Isaiah'], ['je', 'Jeremiah'],
  ['ez', 'Ezekiel'], ['dn', 'Daniel'],
  ['hs', 'Hosea'], ['jl', 'Joel'],
  ['am', 'Amos'], ['ob', 'Obadiah'],
  ['mi', 'Micah'], ['na', 'Nahum'],
  ['hk', 'Habakkuk'], ['hb', 'Habakkuk'],
  ['zp', 'Zephaniah'], ['hg', 'Haggai'],
  ['zc', 'Zechariah'], ['ml', 'Malachi'],
  ['jd', 'Jude'],
  // Additional common short forms for books that had no alias
  ['neh', 'Nehemiah'], ['est', 'Esther'], ['esth', 'Esther'],
  ['lam', 'Lamentations'], ['la', 'Lamentations'],
  ['ga', 'Galatians'], ['gal', 'Galatians'],
  ['eph', 'Ephesians'], ['ep', 'Ephesians'],
  ['php', 'Philippians'], ['ph', 'Philippians'],
  ['col', 'Colossians'], ['co', 'Colossians'],
  ['tit', 'Titus'], ['phm', 'Philemon'],
  ['phlm', 'Philemon'], ['phn', 'Philemon'],
];
for (const [alias, name] of EXTRA_ALIASES) addVariant(alias, name);

// List for fuzzy prefix matching
const ALL_VARIANTS: Array<{ variant: string; book: string }> = [];
for (const [variant, book] of BOOK_VARIANTS) ALL_VARIANTS.push({ variant, book });

// Chapter count per book for validation
const CHAPTER_COUNTS: Map<string, number> = new Map();
for (const b of BIBLE_BOOKS) CHAPTER_COUNTS.set(b.name, b.chapters);

// ─── Parser ──────────────────────────────────────────────────────────────────

interface ParsedRef {
  bookQuery: string;
  chapter: number;
  verse: number;
  verseEnd?: number;
  source: 'spaced' | 'compact';
}

function tryParses(input: string): ParsedRef[] {
  const s = input.trim().toLowerCase();
  if (!s) return [];
  const parses: ParsedRef[] = [];

  // Spaced format patterns (tried in priority order)
  // Verse range: "John 3:1-6"
  let m = s.match(/^(.+?)\s+(\d+):(\d+)-(\d+)$/);
  if (m) parses.push({ bookQuery: m[1], chapter: +m[2], verse: +m[3], verseEnd: +m[4], source: 'spaced' });

  // Single verse: "John 3:16"
  m = s.match(/^(.+?)\s+(\d+):(\d+)$/);
  if (m) parses.push({ bookQuery: m[1], chapter: +m[2], verse: +m[3], source: 'spaced' });

  // Verse range with spaces: "John 3 1-6"
  m = s.match(/^(.+?)\s+(\d+)\s+(\d+)-(\d+)$/);
  if (m) parses.push({ bookQuery: m[1], chapter: +m[2], verse: +m[3], verseEnd: +m[4], source: 'spaced' });

  // Two numbers: "John 3 16"
  m = s.match(/^(.+?)\s+(\d+)\s+(\d+)$/);
  if (m) parses.push({ bookQuery: m[1], chapter: +m[2], verse: +m[3], source: 'spaced' });

  // Book + chapter: "John 3"
  m = s.match(/^(.+?)\s+(\d+)$/);
  if (m) parses.push({ bookQuery: m[1], chapter: +m[2], verse: 1, source: 'spaced' });

  // Just a book name
  parses.push({ bookQuery: s, chapter: 1, verse: 1, source: 'spaced' });

  // Compact format (spaces removed) — always try, even if input had no spaces,
  // to handle inputs like "jn3:16", "ps23", "1jn2:1", "ps23:1-6"
  const compact = s.replace(/\s/g, '');
  // Verse range: "jn3:1-6"
  m = compact.match(/^(.+?)(\d+):(\d+)-(\d+)$/);
  if (m) parses.push({ bookQuery: m[1], chapter: +m[2], verse: +m[3], verseEnd: +m[4], source: 'compact' });

  // Single verse with colon: "jn3:16"
  m = compact.match(/^(.+?)(\d+):(\d+)$/);
  if (m) parses.push({ bookQuery: m[1], chapter: +m[2], verse: +m[3], source: 'compact' });

  // Book + chapter: "ps23"
  m = compact.match(/^(.+?)(\d+)$/);
  if (m) parses.push({ bookQuery: m[1], chapter: +m[2], verse: 1, source: 'compact' });

  return parses;
}

function isValidRef(book: string, chapter: number, verse: number, verseEnd?: number): boolean {
  const maxCh = CHAPTER_COUNTS.get(book);
  if (!maxCh) return false;
  if (chapter < 1 || chapter > maxCh) return false;
  if (verse < 1) return false;
  if (verseEnd !== undefined) {
    if (verseEnd < verse) return false;
  }
  return true;
}

function buildRefString(book: string, chapter: number, verse: number, verseEnd?: number): string {
  if (verseEnd !== undefined && verseEnd !== verse) {
    return `${book} ${chapter}:${verse}-${verseEnd}`;
  }
  return `${book} ${chapter}:${verse}`;
}

/**
 * Parse a free-form query and return ranked Bible reference matches.
 * Handles "jn3:16", "John 3:16", "1 jn 2 1", "ps23", "1 john", "ps23:1-6", etc.
 */
export function searchBibleReferences(query: string, maxResults = 5): BibleRefMatch[] {
  const parses = tryParses(query);
  if (parses.length === 0) return [];

  const results: BibleRefMatch[] = [];
  const seen = new Set<string>();

  for (const { bookQuery, chapter, verse, verseEnd, source } of parses) {
    const normalized = bookQuery.replace(/\s/g, '');
    if (!normalized) continue;

    // Exact match
    if (BOOK_VARIANTS.has(normalized)) {
      const book = BOOK_VARIANTS.get(normalized)!;
      if (isValidRef(book, chapter, verse, verseEnd)) {
        const ref = buildRefString(book, chapter, verse, verseEnd);
        if (!seen.has(ref)) {
          seen.add(ref);
          results.push({
            book, chapter, verse, verseEnd, reference: ref,
            score: source === 'spaced' ? 100 : 90,
          });
        }
      }
    }

    // Prefix fuzzy match (query is a prefix of a known variant)
    if (normalized.length >= 2) {
      for (const { variant, book } of ALL_VARIANTS) {
        if (variant === normalized) continue;
        if (variant.startsWith(normalized)) {
          if (isValidRef(book, chapter, verse, verseEnd)) {
            const ref = buildRefString(book, chapter, verse, verseEnd);
            if (!seen.has(ref)) {
              seen.add(ref);
              results.push({
                book, chapter, verse, verseEnd, reference: ref,
                score: source === 'spaced' ? 70 : 60,
              });
            }
          }
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}