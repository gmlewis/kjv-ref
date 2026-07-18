// Settings export/import utilities for KJV-Ref.
//
// Export: collects ALL localStorage keys used by the app into a single JSON
// object and triggers a browser download as "kjv-ref-YYYYMMDD.json".
//
// Import: reads an imported JSON file and NON-DESTRUCTIVELY merges bookmarks
// (favorites) into the browser's localStorage. Existing bookmarks are preserved;
// imported bookmarks that are not already present are added.

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

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportedSettings {
  version: 1;
  exportedAt: string;
  keys: Record<string, string>;
}

/**
 * Collect all KJV-Ref localStorage data into a single JSON object.
 * Returns the JSON string ready for download.
 */
export function collectSettings(): ExportedSettings {
  const keys: Record<string, string> = {};
  for (const key of ALL_KJV_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
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

  const importedBookmarks = JSON.parse(importedBookmarksRaw) as Array<{ reference: string; addedAt?: string }>;
  if (!Array.isArray(importedBookmarks)) {
    return { addedBookmarks: 0, skippedDuplicates: 0 };
  }

  // Read existing bookmarks
  const existingRaw = localStorage.getItem('kjv-memorize-bookmarks');
  const existing: Array<{ reference: string; addedAt?: string }> = existingRaw
    ? JSON.parse(existingRaw)
    : [];
  const existingRefs = new Set(existing.map(b => b.reference));

  let added = 0;
  let skipped = 0;
  for (const bm of importedBookmarks) {
    if (!bm.reference) { skipped++; continue; }
    if (existingRefs.has(bm.reference)) {
      skipped++;
    } else {
      existing.push(bm);
      existingRefs.add(bm.reference);
      added++;
    }
  }

  if (added > 0) {
    localStorage.setItem('kjv-memorize-bookmarks', JSON.stringify(existing));
    // Dispatch storage change event so hooks refresh
    window.dispatchEvent(new CustomEvent('kjv-storage-change', { detail: { key: 'kjv-memorize-bookmarks' } }));
  }

  return { addedBookmarks: added, skippedDuplicates: skipped };
}