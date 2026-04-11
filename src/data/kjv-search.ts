import MiniSearch from 'minisearch';
import { getKJVBible, BOOK_ABBR_MAP } from './kjv-bible';

// 1.3.1 — SearchResult interface
export interface SearchResult {
  reference: string;
  text: string;
  book: string;
  chapter: number;
  verse: number;
  score: number;
}

// 1.3.2 — SearchOptions interface
export interface SearchOptions {
  testament?: 'old' | 'new';
  book?: string;
  limit?: number;
}

// Build a name→testament map once at module level
const BOOK_TESTAMENT_MAP: Record<string, 'old' | 'new'> = {};
for (const info of Object.values(BOOK_ABBR_MAP)) {
  BOOK_TESTAMENT_MAP[info.name] = info.testament;
}

// 1.3.3 — Lazy-built MiniSearch index (module-level cache)
let _index: MiniSearch | null = null;

async function buildSearchIndex(): Promise<MiniSearch> {
  if (_index) return _index;

  const bible = await getKJVBible();

  const ms = new MiniSearch({
    idField: 'reference',
    fields: ['text', 'book'],
    storeFields: ['reference', 'book', 'chapter', 'verse', 'testament'],
    // Use high length-normalization (b=2.0) so shorter docs with the query term
    // score above longer docs with multiple occurrences. This ensures canonical
    // short verses (e.g. Psalm 23:1 for "shepherd") rank above longer passages.
    searchOptions: {
      bm25: { k: 1.2, b: 2.0, d: 0.5 },
    },
  });

  const docs: Array<{
    reference: string;
    text: string;
    book: string;
    chapter: number;
    verse: number;
    testament: 'old' | 'new';
  }> = [];

  for (const [bookName, chapters] of bible) {
    const testament = BOOK_TESTAMENT_MAP[bookName] ?? 'old';
    for (const [chapter, verses] of chapters) {
      for (const v of verses) {
        docs.push({
          reference: v.reference,
          text: v.text,
          book: bookName,
          chapter,
          verse: v.verse,
          testament,
        });
      }
    }
  }

  ms.addAll(docs);
  _index = ms;
  return _index;
}

// 1.3.4 / 1.3.5 — searchKJV (async, exported)
export async function searchKJV(query: string, options: SearchOptions): Promise<SearchResult[]> {
  if (query.trim() === '') return [];

  const index = await buildSearchIndex();
  const limit = options.limit ?? 50;

  const raw = index.search(query, {
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'OR',
    boost: { text: 2 },
  });

  type IndexedDoc = { reference: string; book: string; chapter: number; verse: number; testament: 'old' | 'new'; score: number; terms: string[]; match: Record<string, string[]> };
  let filtered = (raw as unknown) as IndexedDoc[];

  if (options.testament) {
    filtered = filtered.filter(r => r.testament === options.testament);
  }
  if (options.book) {
    filtered = filtered.filter(r => r.book === options.book);
  }

  // Sort by descending score (MiniSearch already returns them sorted, but re-sort after filtering)
  filtered.sort((a, b) => b.score - a.score);

  // Slice to limit
  const sliced = filtered.slice(0, limit);

  // Build the bible map to retrieve verse text
  const bible = await getKJVBible();

  return sliced.map(r => {
    const verseText = bible.get(r.book)?.get(r.chapter)?.find(v => v.verse === r.verse)?.text ?? '';
    return {
      reference: r.reference,
      text: verseText,
      book: r.book,
      chapter: r.chapter,
      verse: r.verse,
      score: r.score,
    };
  });
}

/** For testing: reset the cached index (call when _setBibleForTesting is used) */
export function _resetSearchIndexForTesting(): void {
  _index = null;
}
