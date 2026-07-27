// Settings export/import utilities for KJV-Ref.
//
// Export: collects ALL localStorage keys used by the app into a single JSON
// object and triggers a browser download as "kjv-ref-YYYYMMDD.json".
//
// The "kjv-memorize-bookmarks" key is exported as a human-friendly sorted list
// of reference strings (e.g. ["Genesis 1:1", "John 3:16", ...]) in Bible book
// order, deduplicated, so the exported file is easy to manually edit and share.
//
// Import: reads an imported JSON file and restores it into the browser's
// localStorage. Per-verse training stats, review schedule, sessions,
// achievements, daily goal, game progress, and UI preferences are REPLACED
// (mirrored from the file) so a user can copy their full progress from one
// browser (e.g. desktop) to another (e.g. mobile) for uninterrupted practice.
//
// Favorites (bookmarks) are the exception: they are MERGED, not replaced —
// existing local favorites are preserved, and only new (non-duplicate)
// references from the file are added (with common misspelling correction). This
// keeps the exported file useful as a shareable, hand-editable list of favorite
// verses (e.g. curating a list to share with a friend) without clobbering the
// user's existing favorites on import.
//
// After writing each changed key a 'kjv-storage-change' event is dispatched so
// any live hooks refetch from localStorage without a page reload.

import { BIBLE_BOOKS } from './bibleBooks';

// ─── All localStorage keys used by the app ───────────────────────────────────

export const ALL_KJV_STORAGE_KEYS = [
  'kjv-theme',
  'kjv-verse-font-size',
  'kjv-strongs-enabled',
  'kjv-interlinear-enabled',
  'kjv-memorize-progress',
  'kjv-memorize-sessions',
  'kjv-memorize-achievements',
  'kjv-memorize-bookmarks',
  'kjv-memorize-daily-goal',
  'kjv-memorize-review-schedule',
  'kjv-game-state',
] as const;

// ─── Bible book order map for sorting references ─────────────────────────────

const BOOK_ORDER: Record<string, number> = {};
for (let i = 0; i < BIBLE_BOOKS.length; i++) {
  BOOK_ORDER[BIBLE_BOOKS[i].name] = i;
}

/**
 * Parse a reference like "1 John 3:16" or "Psalms 23:1-6" into { book, chapter, verse }.
 * Handles multi-word book names and verse ranges.
 */
function parseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  const m = ref.match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  return { book: m[1], chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) };
}

/**
 * Sort references in Bible book order, then chapter, then verse.
 * Books not in BIBLE_BOOKS sort to the end alphabetically.
 */
function sortReferences(refs: string[]): string[] {
  return [...refs].sort((a, b) => {
    const pa = parseRef(a);
    const pb = parseRef(b);
    if (!pa || !pb) return a.localeCompare(b);
    const oa = BOOK_ORDER[pa.book] ?? 999;
    const ob = BOOK_ORDER[pb.book] ?? 999;
    if (oa !== ob) return oa - ob;
    if (pa.chapter !== pb.chapter) return pa.chapter - pb.chapter;
    return pa.verse - pb.verse;
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportedSettings {
  version: 1;
  exportedAt: string;
  keys: Record<string, unknown>;
}

/**
 * Collect all KJV-Ref localStorage data into a single JSON object.
 * All values are parsed from their localStorage string form into native JSON
 * types (arrays, objects, strings, numbers) so the exported file contains
 * real JSON, not stringified JSON.
 *
 * Bookmarks are converted to a deduplicated, Bible-order-sorted array of
 * reference strings for human readability.
 */
export function collectSettings(): ExportedSettings {
  const keys: Record<string, unknown> = {};
  for (const key of ALL_KJV_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value === null) continue;

    if (key === 'kjv-memorize-bookmarks') {
      // Convert bookmark objects to a sorted, deduplicated list of reference strings
      let bookmarks: Array<{ reference: string }> = [];
      try { bookmarks = JSON.parse(value); } catch { bookmarks = []; }
      const refs = Array.isArray(bookmarks)
        ? bookmarks.map(b => b.reference).filter(Boolean)
        : [];
      const unique = [...new Set(refs)];
      keys[key] = sortReferences(unique);
    } else {
      // Parse all other values from their localStorage string form into native JSON types
      try {
        keys[key] = JSON.parse(value);
      } catch {
        // If it's not valid JSON (e.g. "dark", "1"), store as a plain string
        keys[key] = value;
      }
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    keys,
  };
}

/**
 * Generate the download filename for today: "kjv-ref-YYYYMMDD.json"
 */
export function downloadFilename(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `kjv-ref-${y}${m}${d}.json`;
}

/**
 * Trigger a browser download of all KJV-Ref settings as a JSON file.
 */
export function downloadSettings(): void {
  const data = collectSettings();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Common misspelling corrections ──────────────────────────────────────────

/** Map of common book name misspellings to their correct spelling. */
const MISSPELLINGS: Record<string, string> = {
  'galations': 'Galatians',
  'psalm': 'Psalms',
};

/**
 * Correct common book name misspellings in a reference string.
 * e.g. "Galations 2:20" → "Galatians 2:20", "Psalm 51:7" → "Psalms 51:7"
 */
function correctMisspelling(ref: string): string {
  const m = ref.match(/^(.+?) (\d+:\d+(?:-\d+)?)$/);
  if (!m) return ref;
  const bookLower = m[1].toLowerCase();
  if (MISSPELLINGS[bookLower]) {
    return `${MISSPELLINGS[bookLower]} ${m[2]}`;
  }
  return ref;
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  /** Recognized keys handled (present) from the file. */
  restoredKeys: string[];
  /** Number of per-verse progress entries replaced. */
  progressCount: number;
  /** Total favorites present locally after merging. */
  bookmarkCount: number;
  /** Favorites newly added by the merge. */
  addedBookmarks: number;
  /** Imported favorites skipped (already present locally, or invalid). */
  skippedDuplicates: number;
  /** Number of review-schedule entries replaced. */
  scheduleCount: number;
  /** Number of session-history entries replaced. */
  sessionCount: number;
}

type BookmarkObject = {
  id: string;
  user: { id: string };
  reference: string;
  addedAt: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Merge an imported list of reference strings into the local favorites,
 * NON-DESTRUCTIVELY: existing local favorites are preserved, and only
 * references not already present are appended (after common misspelling
 * correction and deduplication). Returns the merged object array (in the app's
 * internal storage format) and counts of added / skipped entries.
 *
 * This deliberately keeps favorites additive so the exported JSON remains a
 * shareable, hand-editable list of verses — importing a friend's favorites adds
 * them without wiping your own, and manually adding verses to the file works the
 * same way.
 */
function mergeBookmarks(refs: unknown[]): { objects: BookmarkObject[]; added: number; skipped: number } {
  const existingRaw = localStorage.getItem('kjv-memorize-bookmarks');
  let existing: BookmarkObject[] = [];
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw);
      if (Array.isArray(parsed)) existing = parsed as BookmarkObject[];
    } catch { existing = []; }
  }
  const existingRefs = new Set(existing.map(b => b.reference));

  let added = 0;
  let skipped = 0;
  for (const ref of refs) {
    if (!ref || typeof ref !== 'string') { skipped++; continue; }
    // Correct common misspellings (e.g. "Galations" → "Galatians", "Psalm" → "Psalms")
    const corrected = correctMisspelling(ref);
    if (existingRefs.has(corrected)) {
      skipped++;
    } else {
      const now = new Date().toISOString();
      existing.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        user: { id: 'anonymous' },
        reference: corrected,
        addedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      existingRefs.add(corrected);
      added++;
    }
  }
  return { objects: existing, added, skipped };
}

/**
 * Parse a settings JSON file and restore it into the browser's localStorage.
 *
 * Per-verse progress, review schedule, sessions, achievements, daily goal, game
 * progress, and UI preferences are REPLACED with the file's values (a full
 * mirror) so a user can copy their complete training progress from one browser
 * to another for uninterrupted practice.
 *
 * Favorites (bookmarks) are MERGED, not replaced: existing local favorites are
 * kept, and only new (non-duplicate, misspelling-corrected) references from the
 * file are added — so the exported JSON remains a shareable, hand-editable list
 * of favorite verses.
 *
 * Only recognized keys (ALL_KJV_STORAGE_KEYS) are written; unknown keys in the
 * file are ignored so a crafted file cannot pollute arbitrary localStorage.
 *
 * String values (e.g. theme "dark") are stored verbatim; objects/arrays/numbers
 * are JSON-stringified, matching how the app stores them.
 *
 * A 'kjv-storage-change' CustomEvent is dispatched for each replaced key, and
 * for bookmarks when at least one new favorite was added, so live hooks refetch
 * without a page reload.
 *
 * Returns a summary of what was restored / merged.
 */
export function importSettings(jsonString: string): ImportResult {
  const data = JSON.parse(jsonString) as ExportedSettings;
  if (!data || typeof data !== 'object' || !data.keys || typeof data.keys !== 'object') {
    throw new Error('Invalid settings file: missing "keys" field');
  }

  const knownKeys = new Set<string>(ALL_KJV_STORAGE_KEYS);

  const restoredKeys: string[] = [];
  let progressCount = 0;
  let bookmarkCount = 0;
  let addedBookmarks = 0;
  let skippedDuplicates = 0;
  let scheduleCount = 0;
  let sessionCount = 0;

  for (const key of Object.keys(data.keys)) {
    if (!knownKeys.has(key)) continue; // only handle recognized keys
    const value = data.keys[key];
    restoredKeys.push(key);

    if (key === 'kjv-memorize-bookmarks') {
      const refs: unknown[] = Array.isArray(value) ? value : [];
      const { objects, added, skipped } = mergeBookmarks(refs);
      bookmarkCount = objects.length;
      addedBookmarks = added;
      skippedDuplicates = skipped;
      if (added > 0) {
        localStorage.setItem(key, JSON.stringify(objects));
        window.dispatchEvent(new CustomEvent('kjv-storage-change', { detail: { key } }));
      }
      continue;
    }

    // String values (e.g. theme "dark") are stored verbatim; everything else
    // (objects/arrays/numbers) is JSON-stringified, matching the app's storage.
    const stored = typeof value === 'string' ? value : JSON.stringify(value);
    if (Array.isArray(value)) {
      if (key === 'kjv-memorize-progress') progressCount = value.length;
      else if (key === 'kjv-memorize-review-schedule') scheduleCount = value.length;
      else if (key === 'kjv-memorize-sessions') sessionCount = value.length;
    }
    localStorage.setItem(key, stored);
    window.dispatchEvent(new CustomEvent('kjv-storage-change', { detail: { key } }));
  }

  return { restoredKeys, progressCount, bookmarkCount, addedBookmarks, skippedDuplicates, scheduleCount, sessionCount };
}

// ─── Exported for testing ────────────────────────────────────────────────────

export { sortReferences, parseRef, correctMisspelling };
