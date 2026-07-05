export interface KJVParsedLine {
  abbr: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface KJVVerseEntry {
  verse: number;
  text: string;
  reference: string;
}

// Map: full book name → Map<chapter, verse[]>
type BibleMap = Map<string, Map<number, KJVVerseEntry[]>>;

export interface BookInfo {
  name: string;
  testament: 'old' | 'new';
  order: number;
}

export const BOOK_ABBR_MAP: Record<string, BookInfo> = {
  Ge:     { name: 'Genesis',          testament: 'old', order: 1  },
  Exo:    { name: 'Exodus',           testament: 'old', order: 2  },
  Lev:    { name: 'Leviticus',        testament: 'old', order: 3  },
  Num:    { name: 'Numbers',          testament: 'old', order: 4  },
  Deu:    { name: 'Deuteronomy',      testament: 'old', order: 5  },
  Josh:   { name: 'Joshua',           testament: 'old', order: 6  },
  Jdgs:   { name: 'Judges',           testament: 'old', order: 7  },
  Ruth:   { name: 'Ruth',             testament: 'old', order: 8  },
  '1Sm':  { name: '1 Samuel',         testament: 'old', order: 9  },
  '2Sm':  { name: '2 Samuel',         testament: 'old', order: 10 },
  '1Ki':  { name: '1 Kings',          testament: 'old', order: 11 },
  '2Ki':  { name: '2 Kings',          testament: 'old', order: 12 },
  '1Chr': { name: '1 Chronicles',     testament: 'old', order: 13 },
  '2Chr': { name: '2 Chronicles',     testament: 'old', order: 14 },
  Ezra:   { name: 'Ezra',             testament: 'old', order: 15 },
  Neh:    { name: 'Nehemiah',         testament: 'old', order: 16 },
  Est:    { name: 'Esther',           testament: 'old', order: 17 },
  Job:    { name: 'Job',              testament: 'old', order: 18 },
  Psa:    { name: 'Psalms',           testament: 'old', order: 19 },
  Prv:    { name: 'Proverbs',         testament: 'old', order: 20 },
  Eccl:   { name: 'Ecclesiastes',     testament: 'old', order: 21 },
  SSol:   { name: 'Song of Solomon',  testament: 'old', order: 22 },
  Isa:    { name: 'Isaiah',           testament: 'old', order: 23 },
  Jer:    { name: 'Jeremiah',         testament: 'old', order: 24 },
  Lam:    { name: 'Lamentations',     testament: 'old', order: 25 },
  Eze:    { name: 'Ezekiel',          testament: 'old', order: 26 },
  Dan:    { name: 'Daniel',           testament: 'old', order: 27 },
  Hos:    { name: 'Hosea',            testament: 'old', order: 28 },
  Joel:   { name: 'Joel',             testament: 'old', order: 29 },
  Amos:   { name: 'Amos',             testament: 'old', order: 30 },
  Obad:   { name: 'Obadiah',          testament: 'old', order: 31 },
  Jonah:  { name: 'Jonah',            testament: 'old', order: 32 },
  Mic:    { name: 'Micah',            testament: 'old', order: 33 },
  Nahum:  { name: 'Nahum',            testament: 'old', order: 34 },
  Hab:    { name: 'Habakkuk',         testament: 'old', order: 35 },
  Zep:    { name: 'Zephaniah',        testament: 'old', order: 36 },
  Hag:    { name: 'Haggai',           testament: 'old', order: 37 },
  Zec:    { name: 'Zechariah',        testament: 'old', order: 38 },
  Mal:    { name: 'Malachi',          testament: 'old', order: 39 },
  Mat:    { name: 'Matthew',          testament: 'new', order: 40 },
  Mark:   { name: 'Mark',             testament: 'new', order: 41 },
  Luke:   { name: 'Luke',             testament: 'new', order: 42 },
  John:   { name: 'John',             testament: 'new', order: 43 },
  Acts:   { name: 'Acts',             testament: 'new', order: 44 },
  Rom:    { name: 'Romans',           testament: 'new', order: 45 },
  '1Cor': { name: '1 Corinthians',    testament: 'new', order: 46 },
  '2Cor': { name: '2 Corinthians',    testament: 'new', order: 47 },
  Gal:    { name: 'Galatians',        testament: 'new', order: 48 },
  Eph:    { name: 'Ephesians',        testament: 'new', order: 49 },
  Phi:    { name: 'Philippians',      testament: 'new', order: 50 },
  Col:    { name: 'Colossians',       testament: 'new', order: 51 },
  '1Th':  { name: '1 Thessalonians',  testament: 'new', order: 52 },
  '2Th':  { name: '2 Thessalonians',  testament: 'new', order: 53 },
  '1Tim': { name: '1 Timothy',        testament: 'new', order: 54 },
  '2Tim': { name: '2 Timothy',        testament: 'new', order: 55 },
  Titus:  { name: 'Titus',            testament: 'new', order: 56 },
  Phmn:   { name: 'Philemon',         testament: 'new', order: 57 },
  Heb:    { name: 'Hebrews',          testament: 'new', order: 58 },
  Jas:    { name: 'James',            testament: 'new', order: 59 },
  '1Pet': { name: '1 Peter',          testament: 'new', order: 60 },
  '2Pet': { name: '2 Peter',          testament: 'new', order: 61 },
  '1Jn':  { name: '1 John',           testament: 'new', order: 62 },
  '2Jn':  { name: '2 John',           testament: 'new', order: 63 },
  '3Jn':  { name: '3 John',           testament: 'new', order: 64 },
  Jude:   { name: 'Jude',             testament: 'new', order: 65 },
  Rev:    { name: 'Revelation',       testament: 'new', order: 66 },
};

// Regex: optional leading digit, then letters (book abbr), then digits (chapter), colon, digits (verse), space, text
const LINE_RE = /^(\d?[A-Za-z]+)(\d+):(\d+) (.+)$/;

export function parseKJVLine(line: string): KJVParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const m = trimmed.match(LINE_RE);
  if (!m) return null;
  const abbr = m[1];
  if (!(abbr in BOOK_ABBR_MAP)) return null;
  return {
    abbr,
    chapter: parseInt(m[2], 10),
    verse: parseInt(m[3], 10),
    text: m[4],
  };
}

export function parseKJVBible(rawText: string): BibleMap {
  const bible: BibleMap = new Map();
  for (const line of rawText.split('\n')) {
    const parsed = parseKJVLine(line);
    if (!parsed) continue;
    const bookInfo = BOOK_ABBR_MAP[parsed.abbr];
    if (!bookInfo) continue;
    const { name } = bookInfo;
    if (!bible.has(name)) bible.set(name, new Map());
    const bookMap = bible.get(name)!;
    if (!bookMap.has(parsed.chapter)) bookMap.set(parsed.chapter, []);
    bookMap.get(parsed.chapter)!.push({
      verse: parsed.verse,
      text: parsed.text,
      reference: `${name} ${parsed.chapter}:${parsed.verse}`,
    });
  }
  return bible;
}

// Async lazy-loaded singleton — fetches kjv.txt from the public folder at runtime
let _bible: BibleMap | null = null;
let _loading: Promise<BibleMap> | null = null;

async function getBible(): Promise<BibleMap> {
  if (_bible) return _bible;
  if (_loading) return _loading;
  // Fetch from public folder
  _loading = fetch(`${import.meta.env.BASE_URL}kjv.txt`)
    .then(r => r.text())
    .then(text => {
      _bible = parseKJVBible(text);
      return _bible;
    });
  return _loading;
}

export async function getKJVChapter(book: string, chapter: number): Promise<KJVVerseEntry[]> {
  const bible = await getBible();
  return bible.get(book)?.get(chapter) ?? [];
}

export async function getKJVVerse(reference: string): Promise<KJVVerseEntry | null> {
  const m = reference.match(/^(.+) (\d+):(\d+)$/);
  if (!m) return null;
  const [, book, chapStr, verseStr] = m;
  const bible = await getBible();
  return bible.get(book)?.get(parseInt(chapStr, 10))?.find(v => v.verse === parseInt(verseStr, 10)) ?? null;
}

/** For testing: inject pre-parsed data so fetch is not needed */
export function _setBibleForTesting(rawText: string): void {
  _bible = parseKJVBible(rawText);
  _loading = null;
}

/** Returns the full parsed bible map (lazy singleton). Used by search index builder. */
export async function getKJVBible(): Promise<BibleMap> {
  return getBible();
}

export async function getKJVChapterList(book: string): Promise<number[]> {
  const bible = await getBible();
  const chapters = bible.get(book);
  if (!chapters) return [];
  return Array.from(chapters.keys()).sort((a, b) => a - b);
}

export function getAllBookNames(): string[] {
  return Object.values(BOOK_ABBR_MAP)
    .sort((a, b) => a.order - b.order)
    .map(b => b.name);
}
