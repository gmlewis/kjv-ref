import { BOOK_ABBR_MAP } from './kjv-bible';

// ─── Word-level data types ────────────────────────────────────────────────────
// Compact tuple: [word, strongs, translit, gloss, parsing]
export type WordEntry = [string, string, string, string, string];
export type BookWordMap = Record<string, WordEntry[]>;

// Reverse map: full book name → abbreviation
const FULL_NAME_TO_ABBR = new Map<string, string>(
  Object.entries(BOOK_ABBR_MAP).map(([abbr, info]) => [info.name, abbr])
);

// ─── Lazy singletons ─────────────────────────────────────────────────────────
let _hebrew: Record<string, string> | null = null;
let _hebrewLoading: Promise<Record<string, string>> | null = null;

let _greek: Record<string, string> | null = null;
let _greekLoading: Promise<Record<string, string>> | null = null;

export async function getInterlinearHebrew(): Promise<Record<string, string>> {
  if (_hebrew) return _hebrew;
  if (!_hebrewLoading) {
    // Direct fetch from public folder - no Prophet needed
    _hebrewLoading = fetch(`${import.meta.env.BASE_URL}interlinear/hebrew.json`)
      .then(r => r.json())
      .then(d => { _hebrew = d; return d; });
  }
  return _hebrewLoading;
}

export async function getInterlinearGreek(): Promise<Record<string, string>> {
  if (_greek) return _greek;
  if (!_greekLoading) {
    // Direct fetch from public folder - no Prophet needed
    _greekLoading = fetch(`${import.meta.env.BASE_URL}interlinear/greek.json`)
      .then(r => r.json())
      .then(d => { _greek = d; return d; });
  }
  return _greekLoading;
}

export const _wordCache = new Map<string, BookWordMap>();
export const _wordLoading = new Map<string, Promise<BookWordMap>>();

export async function getInterlinearWordBook(abbr: string): Promise<BookWordMap> {
  if (_wordCache.has(abbr)) return _wordCache.get(abbr)!;
  if (!_wordLoading.has(abbr)) {
    const url = `${import.meta.env.BASE_URL}interlinear/words/${abbr}.json`;
    const p = fetch(url)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((d: BookWordMap) => { _wordCache.set(abbr, d); return d; })
      .catch(() => { _wordLoading.delete(abbr); return {} as BookWordMap; });
    _wordLoading.set(abbr, p);
  }
  return _wordLoading.get(abbr)!;
}

/** Look up a single verse in the original language. Returns null if not found. */
export async function getInterlinearVerse(
  bookName: string,
  chapter: number,
  verse: number
): Promise<string | null> {
  const abbr = FULL_NAME_TO_ABBR.get(bookName);
  if (!abbr) return null;
  const testament = BOOK_ABBR_MAP[abbr]?.testament;
  const key = `${abbr}.${chapter}.${verse}`;
  if (testament === 'old') {
    const map = await getInterlinearHebrew();
    return map[key] ?? null;
  } else {
    const map = await getInterlinearGreek();
    return map[key] ?? null;
  }
}

/**
 * Fetch all interlinear verses for a chapter at once.
 * Returns a map of verse number → original-language text.
 */
export async function getInterlinearChapter(
  bookName: string,
  chapter: number,
  verseNums: number[]
): Promise<Map<number, string>> {
  const abbr = FULL_NAME_TO_ABBR.get(bookName);
  const result = new Map<number, string>();
  if (!abbr) return result;
  const testament = BOOK_ABBR_MAP[abbr]?.testament;
  const map = testament === 'old'
    ? await getInterlinearHebrew()
    : await getInterlinearGreek();
  for (const v of verseNums) {
    const text = map[`${abbr}.${chapter}.${v}`];
    if (text) result.set(v, text);
  }
  return result;
}
