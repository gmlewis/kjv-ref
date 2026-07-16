// Bible Query Evaluator
// Evaluates a parsed Bible query (AST) against the KJV Bible text.
// Works directly against the in-memory BibleMap (cached after first load).

import { getKJVBible, BOOK_ABBR_MAP, type KJVVerseEntry } from '../data/kjv-bible';
import {
  parseBibleQuery,
  matchWord,
  verseWords,
  type QueryNode,
  type ParsedQuery,
} from './bibleQueryParser';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BibleSearchResult {
  reference: string;
  text: string;
  book: string;
  chapter: number;
  verse: number;
  score: number;
}

export interface BibleSearchOptions {
  testament?: 'old' | 'new';
  book?: string;
  limit?: number;
}

// ─── Node matching ───────────────────────────────────────────────────────────

/** Check if a single word position matches a single QueryNode. */
function nodeMatchesWord(word: string, node: QueryNode): boolean {
  return matchWord(word, node);
}

/**
 * Check if a phrase (sequence of QueryNodes) matches at a given position
 * in the verse's word array. Returns true if the phrase matches starting
 * at `startIdx`.
 */
function phraseMatchesAt(words: string[], nodes: QueryNode[], startIdx: number): boolean {
  for (let k = 0; k < nodes.length; k++) {
    const idx = startIdx + k;
    if (idx >= words.length) return false;
    const node = nodes[k];
    if (node.type === 'anyWord') {
      // anyWord matches any single word (but must consume one)
      continue;
    }
    if (!nodeMatchesWord(words[idx], node)) return false;
  }
  return true;
}

/**
 * Check if a phrase node matches anywhere in the verse.
 * A phrase is a sequence of words that must appear consecutively.
 */
function phraseMatchesInVerse(words: string[], phraseNodes: QueryNode[]): boolean {
  if (phraseNodes.length === 0) return false;
  for (let i = 0; i <= words.length - phraseNodes.length; i++) {
    if (phraseMatchesAt(words, phraseNodes, i)) return true;
  }
  return false;
}

/** Check if a single QueryNode (non-phrase) matches anywhere in the verse. */
function nodeMatchesInVerse(words: string[], node: QueryNode): boolean {
  switch (node.type) {
    case 'word':
    case 'wildcard':
    case 'anyWord':
      return words.some(w => nodeMatchesWord(w, node));
    case 'phrase':
      return phraseMatchesInVerse(words, node.words);
    case 'or':
      return node.alternatives.some(alt => nodeMatchesInVerse(words, alt));
    case 'exclude':
      // Exclude is handled at the query level, not per-node
      return false;
  }
}

/** Check if an exclude node DOES match (verse should be excluded if it does). */
function excludeMatchesInVerse(words: string[], node: QueryNode): boolean {
  switch (node.type) {
    case 'word':
    case 'wildcard':
    case 'anyWord':
      return words.some(w => nodeMatchesWord(w, node));
    case 'phrase':
      return phraseMatchesInVerse(words, node.words);
    case 'or':
      return node.alternatives.some(alt => excludeMatchesInVerse(words, alt));
    default:
      return false;
  }
}

// ─── Full query evaluation ───────────────────────────────────────────────────

/**
 * Evaluate a ParsedQuery against a single verse's word array.
 * Returns true if all include terms match AND no exclude terms match.
 */
function verseMatchesQuery(words: string[], query: ParsedQuery): boolean {
  // All include terms must match (AND)
  for (const node of query.include) {
    if (!nodeMatchesInVerse(words, node)) return false;
  }
  // No exclude term must match (NOT)
  for (const node of query.exclude) {
    if (excludeMatchesInVerse(words, node)) return false;
  }
  return true;
}

// ─── Testament map ───────────────────────────────────────────────────────────

const BOOK_TESTAMENT: Record<string, 'old' | 'new'> = {};
for (const info of Object.values(BOOK_ABBR_MAP)) {
  BOOK_TESTAMENT[info.name] = info.testament;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Search the KJV Bible using KJVCanOpener-style query syntax.
 * Falls back gracefully — if the query has no special syntax, it behaves
 * like a simple all-words-must-match search (AND, not OR like MiniSearch).
 */
export async function searchBibleQuery(
  query: string,
  options: BibleSearchOptions = {},
): Promise<BibleSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const parsed = parseBibleQuery(trimmed);
  if (parsed.include.length === 0 && parsed.exclude.length === 0) return [];

  const bible = await getKJVBible();
  const limit = options.limit ?? 50;
  const results: BibleSearchResult[] = [];

  for (const [bookName, chapters] of bible) {
    // Testament filter
    if (options.testament && BOOK_TESTAMENT[bookName] !== options.testament) continue;
    // Book filter
    if (options.book && bookName !== options.book) continue;

    for (const [chapter, verses] of chapters) {
      for (const v of verses) {
        const words = verseWords(v.text);
        if (verseMatchesQuery(words, parsed)) {
          // Score: number of matched terms (higher = more relevant)
          // Plus a small bonus for shorter verses (more specific matches)
          const matchCount = parsed.include.length;
          const lengthBonus = 1 / Math.max(words.length, 1);
          const score = matchCount + lengthBonus;
          results.push({
            reference: v.reference,
            text: v.text,
            book: bookName,
            chapter,
            verse: v.verse,
            score,
          });
        }
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Detect whether a query string uses any special KJVCanOpener syntax.
 * If not, the caller can fall back to the existing MiniSearch (fuzzy) search.
 */
export function hasSpecialSyntax(query: string): boolean {
  return /["|*?\[\]-]/.test(query);
}