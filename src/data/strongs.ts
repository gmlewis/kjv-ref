import { BOOK_ABBR_MAP } from './kjv-bible';

// ─── Types ──────────────────────────────────────────────────────────────────
export type StrongsLanguage = 'hebrew' | 'greek';

export interface StrongsEntry {
  strongs: string;
  lemma: string;
  translit: string;
  pronunciation: string;
  definition: string;
  kjv_def?: string;
}

// ─── Reverse map: full book name → abbreviation ─────────────────────────────
const FULL_NAME_TO_ABBR: Map<string, string> = new Map(
  Object.entries(BOOK_ABBR_MAP).map(([abbr, info]) => [info.name, abbr])
);

// ─── Core pure functions ─────────────────────────────────────────────────────

export function parseStrongsNumber(s: string): { language: StrongsLanguage; number: number } | null {
  const m = /^([HG])0*(\d+)$/.exec(s);
  if (!m) return null;
  return {
    language: m[1] === 'H' ? 'hebrew' : 'greek',
    number: parseInt(m[2], 10),
  };
}

export function getVerseKey(bookName: string, chapter: number, verse: number): string | null {
  const abbr = FULL_NAME_TO_ABBR.get(bookName);
  if (!abbr) return null;
  return `${abbr}.${chapter}.${verse}`;
}

export function getWordStrongsNumbers(verseKey: string, index: Record<string, string[]>): string[] {
  return index[verseKey] ?? [];
}

export function lookupStrongs(strongsNum: string, lexicon: Record<string, any>): StrongsEntry | null {
  const raw = lexicon[strongsNum];
  if (!raw) return null;
  return {
    strongs: strongsNum,
    lemma: raw.lemma ?? '',
    translit: raw.translit ?? raw.xlit ?? '',
    pronunciation: raw.pron ?? raw.translit ?? '',
    definition: raw.strongs_def ?? '',
    kjv_def: raw.kjv_def,
  };
}

export function tokeniseVerse(text: string): string[] {
  return text.split(/\s+/).filter(t => t.length > 0);
}

/** Returns the word index as-is (direct positional mapping to Strong's array). */
export function getTokenWordIndex(_verseText: string, wordIndex: number): number {
  return wordIndex;
}

// ─── Lazy loaders ────────────────────────────────────────────────────────────
let _wordIndex: Record<string, string[]> | null = null;
let _wordIndexLoading: Promise<Record<string, string[]>> | null = null;

let _hebrewLexicon: Record<string, any> | null = null;
let _hebrewLoading: Promise<Record<string, any>> | null = null;

let _greekLexicon: Record<string, any> | null = null;
let _greekLoading: Promise<Record<string, any>> | null = null;

export async function getWordIndex(): Promise<Record<string, string[]>> {
  if (_wordIndex) return _wordIndex;
  if (!_wordIndexLoading) {
    const { getDataUrl } = await import('./dataUrls');
    const url = getDataUrl('strongs/word-index.json', './strongs/word-index.json');
    _wordIndexLoading = fetch(url)
      .then(r => r.json())
      .then(d => { _wordIndex = d; return d; });
  }
  return _wordIndexLoading;
}

export async function getHebrewLexicon(): Promise<Record<string, any>> {
  if (_hebrewLexicon) return _hebrewLexicon;
  if (!_hebrewLoading) {
    const { getDataUrl } = await import('./dataUrls');
    const url = getDataUrl('strongs/hebrew.json', './strongs/hebrew.json');
    _hebrewLoading = fetch(url)
      .then(r => r.json())
      .then(d => { _hebrewLexicon = d; return d; });
  }
  return _hebrewLoading;
}

export async function getGreekLexicon(): Promise<Record<string, any>> {
  if (_greekLexicon) return _greekLexicon;
  if (!_greekLoading) {
    const { getDataUrl } = await import('./dataUrls');
    const url = getDataUrl('strongs/greek.json', './strongs/greek.json');
    _greekLoading = fetch(url)
      .then(r => r.json())
      .then(d => { _greekLexicon = d; return d; });
  }
  return _greekLoading;
}

// ─── Primary convenience function ────────────────────────────────────────────
export async function getVerseWordData(
  bookName: string,
  chapter: number,
  verse: number,
  verseText: string
): Promise<Array<{ token: string; strongs: StrongsEntry | null }>> {
  const verseKey = getVerseKey(bookName, chapter, verse);
  if (!verseKey) return tokeniseVerse(verseText).map(token => ({ token, strongs: null }));

  // Determine testament to avoid fetching unnecessary lexicon
  const abbr = FULL_NAME_TO_ABBR.get(bookName);
  const testament = abbr ? BOOK_ABBR_MAP[abbr]?.testament : undefined;
  const isOT = testament === 'old';
  const isNT = testament === 'new';

  const [wordIndex, hebLex, grkLex] = await Promise.all([
    getWordIndex(),
    isNT ? Promise.resolve({}) : getHebrewLexicon(),
    isOT ? Promise.resolve({}) : getGreekLexicon(),
  ]);

  const strongsNums = getWordStrongsNumbers(verseKey, wordIndex);
  const tokens = tokeniseVerse(verseText);

  return tokens.map((token, i) => {
    const strongsNum = strongsNums[i] ?? null;
    if (!strongsNum) return { token, strongs: null };
    const lexicon = strongsNum.startsWith('H') ? hebLex : grkLex;
    return { token, strongs: lookupStrongs(strongsNum, lexicon) };
  });
}

/** Reset lazy singletons (for testing). */
export function _resetStrongsForTesting(): void {
  _wordIndex = null;
  _wordIndexLoading = null;
  _hebrewLexicon = null;
  _hebrewLoading = null;
  _greekLexicon = null;
  _greekLoading = null;
}
