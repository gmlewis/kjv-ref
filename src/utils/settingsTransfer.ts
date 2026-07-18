// Settings export/import utilities for KJV-Ref.
//
// Export: collects ALL localStorage keys used by the app into a single JSON
// object and triggers a browser download as "kjv-ref-YYYYMMDD.json".
//
// The "kjv-memorize-bookmarks" key is exported as a human-friendly sorted list
// of reference strings (e.g. ["Genesis 1:1", "John 3:16", ...]) in Bible book
// order, deduplicated, so the exported file is easy to manually edit and share.
//
// Import: reads an imported JSON file and NON-DESTRUCTIVELY merges bookmarks
// (favorites) into the browser's localStorage. Existing bookmarks are preserved;
// imported bookmarks that are not already present are added.

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
] as const;

// ─── Bible book order map for sorting references ─────────────────────────────

const BOOK_ORDER: Record<string, number> = {};
for (let i = 0; i < BIBLE_BOOKS.length; i++) {
  BOOK_ORDER[BIBLE_BOOKS[i].name] = i;
}

/**
 * Parse a reference like "1 John 3:16" into { book, chapter, verse }.
 * Handles multi-word book names (e.g. "Song of Solomon", "1 Corinthians").
 */
function parseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  const m = ref.match(/^(.+?) (\d+):(\d+)$/);
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
  keys: Record<string, string>;
}

/**
 * Collect all KJV-Ref localStorage data into a single JSON object.
 * Bookmarks are converted to a deduplicated, Bible-order-sorted array of
 * reference strings for human readability.
 */
export function collectSettings(): ExportedSettings {
  const keys: Record<string, string> = {};
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
      keys[key] = JSON.stringify(sortReferences(unique));
    } else {
      keys[key] = value;
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

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  addedBookmarks: number;
  skippedDuplicates: number;
}

/**
 * Parse a settings JSON file and NON-DESTRUCTIVELY merge bookmarks into
 * the browser's localStorage. Only bookmarks (favorites) are imported —
 * existing bookmarks are preserved, and only new (non-duplicate) bookmarks
 * from the file are added.
 *
 * The imported bookmarks field is expected to be a JSON array of reference
 * strings (e.g. ["John 3:16", "Psalms 23:1"]). The stored bookmark objects
 * are generated with id/timestamps matching the app's internal format.
 *
 * Returns the count of added and skipped bookmarks.
 */
export function importSettings(jsonString: string): ImportResult {
  const data = JSON.parse(jsonString) as ExportedSettings;
  if (!data || typeof data !== 'object' || !data.keys) {
    throw new Error('Invalid settings file: missing "keys" field');
  }

  const importedBookmarksRaw = data.keys['kjv-memorize-bookmarks'];
  if (!importedBookmarksRaw) {
    return { addedBookmarks: 0, skippedDuplicates: 0 };
  }

  const importedRefs = JSON.parse(importedBookmarksRaw) as string[];
  if (!Array.isArray(importedRefs)) {
    return { addedBookmarks: 0, skippedDuplicates: 0 };
  }

  // Read existing bookmarks
  const existingRaw = localStorage.getItem('kjv-memorize-bookmarks');
  const existing: Array<{ id: string; user: { id: string }; reference: string; addedAt: string; createdAt: string; updatedAt: string }> = existingRaw
    ? JSON.parse(existingRaw)
    : [];
  const existingRefs = new Set(existing.map(b => b.reference));

  let added = 0;
  let skipped = 0;
  for (const ref of importedRefs) {
    if (!ref || typeof ref !== 'string') { skipped++; continue; }
    if (existingRefs.has(ref)) {
      skipped++;
    } else {
      const now = new Date().toISOString();
      existing.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        user: { id: 'anonymous' },
        reference: ref,
        addedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      existingRefs.add(ref);
      added++;
    }
  }

  if (added > 0) {
    localStorage.setItem('kjv-memorize-bookmarks', JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('kjv-storage-change', { detail: { key: 'kjv-memorize-bookmarks' } }));
  }

  return { addedBookmarks: added, skippedDuplicates: skipped };
}

// ─── Exported for testing ────────────────────────────────────────────────────

export { sortReferences, parseRef };