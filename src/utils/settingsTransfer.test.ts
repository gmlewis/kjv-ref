import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  collectSettings,
  downloadFilename,
  downloadSettings,
  importSettings,
  sortReferences,
  parseRef,
  correctMisspelling,
  ALL_KJV_STORAGE_KEYS,
  type ExportedSettings,
} from './settingsTransfer';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function setLocalStorage(key: string, value: string) {
  localStorage.setItem(key, value);
}

/** Build an export JSON string with native JSON types (not stringified) */
function makeExportedSettings(keys: Record<string, unknown>): string {
  const data: ExportedSettings = {
    version: 1,
    exportedAt: '2026-07-18T12:00:00.000Z',
    keys,
  };
  return JSON.stringify(data, null, 2);
}

/** Build a bookmark object array (internal localStorage format) */
function makeBookmarkObjects(refs: Array<{ reference: string; addedAt?: string }>): string {
  return JSON.stringify(refs.map(r => ({
    id: Math.random().toString(36).slice(2),
    user: { id: 'anonymous' },
    reference: r.reference,
    addedAt: r.addedAt ?? '2026-01-01T00:00:00.000Z',
    createdAt: r.addedAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: r.addedAt ?? '2026-01-01T00:00:00.000Z',
  })));
}

// ─── ALL_KJV_STORAGE_KEYS ─────────────────────────────────────────────────────

describe('ALL_KJV_STORAGE_KEYS', () => {
  it('includes all 11 known localStorage keys', () => {
    expect(ALL_KJV_STORAGE_KEYS).toHaveLength(11);
  });

  it('includes kjv-theme', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-theme');
  });

  it('includes kjv-verse-font-size', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-verse-font-size');
  });

  it('includes kjv-strongs-enabled', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-strongs-enabled');
  });

  it('includes kjv-interlinear-enabled', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-interlinear-enabled');
  });

  it('includes kjv-memorize-progress', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-memorize-progress');
  });

  it('includes kjv-memorize-sessions', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-memorize-sessions');
  });

  it('includes kjv-memorize-achievements', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-memorize-achievements');
  });

  it('includes kjv-memorize-bookmarks', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-memorize-bookmarks');
  });

  it('includes kjv-memorize-daily-goal', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-memorize-daily-goal');
  });

  it('includes kjv-memorize-review-schedule', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-memorize-review-schedule');
  });

  it('includes kjv-game-state', () => {
    expect(ALL_KJV_STORAGE_KEYS).toContain('kjv-game-state');
  });
});

// ─── parseRef ─────────────────────────────────────────────────────────────────

describe('parseRef', () => {
  it('parses a simple reference', () => {
    expect(parseRef('John 3:16')).toEqual({ book: 'John', chapter: 3, verse: 16 });
  });

  it('parses a multi-word book name', () => {
    expect(parseRef('Song of Solomon 1:1')).toEqual({ book: 'Song of Solomon', chapter: 1, verse: 1 });
  });

  it('parses a numbered book name', () => {
    expect(parseRef('1 Corinthians 13:4')).toEqual({ book: '1 Corinthians', chapter: 13, verse: 4 });
  });

  it('parses Psalms with large numbers', () => {
    expect(parseRef('Psalms 119:105')).toEqual({ book: 'Psalms', chapter: 119, verse: 105 });
  });

  it('returns null for invalid reference', () => {
    expect(parseRef('not a reference')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRef('')).toBeNull();
  });
});

// ─── sortReferences ──────────────────────────────────────────────────────────

describe('sortReferences', () => {
  it('sorts in Bible book order', () => {
    const refs = ['John 3:16', 'Genesis 1:1', 'Psalms 23:1'];
    expect(sortReferences(refs)).toEqual(['Genesis 1:1', 'Psalms 23:1', 'John 3:16']);
  });

  it('sorts by chapter within the same book', () => {
    const refs = ['John 3:16', 'John 1:1', 'John 2:1'];
    expect(sortReferences(refs)).toEqual(['John 1:1', 'John 2:1', 'John 3:16']);
  });

  it('sorts by verse within the same chapter', () => {
    const refs = ['John 3:16', 'John 3:1', 'John 3:10'];
    expect(sortReferences(refs)).toEqual(['John 3:1', 'John 3:10', 'John 3:16']);
  });

  it('handles multi-word book names correctly', () => {
    const refs = ['2 John 1:1', 'Song of Solomon 1:1', '1 John 1:1'];
    // Bible order: Song of Solomon (22), 1 John (62), 2 John (63)
    expect(sortReferences(refs)).toEqual(['Song of Solomon 1:1', '1 John 1:1', '2 John 1:1']);
  });

  it('handles numbered books in correct order', () => {
    const refs = ['2 Kings 1:1', '1 Kings 1:1', '2 Samuel 1:1', '1 Samuel 1:1'];
    expect(sortReferences(refs)).toEqual([
      '1 Samuel 1:1',
      '2 Samuel 1:1',
      '1 Kings 1:1',
      '2 Kings 1:1',
    ]);
  });

  it('does not mutate the input array', () => {
    const refs = ['John 3:16', 'Genesis 1:1'];
    sortReferences(refs);
    expect(refs).toEqual(['John 3:16', 'Genesis 1:1']);
  });

  it('handles empty array', () => {
    expect(sortReferences([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(sortReferences(['John 3:16'])).toEqual(['John 3:16']);
  });

  it('sorts Revelation last', () => {
    const refs = ['Revelation 22:21', 'Genesis 1:1', 'Jude 1:1'];
    expect(sortReferences(refs)).toEqual(['Genesis 1:1', 'Jude 1:1', 'Revelation 22:21']);
  });

  it('sorts Malachi before Matthew (OT → NT boundary)', () => {
    const refs = ['Matthew 1:1', 'Malachi 4:6'];
    expect(sortReferences(refs)).toEqual(['Malachi 4:6', 'Matthew 1:1']);
  });
});

// ─── collectSettings ─────────────────────────────────────────────────────────

describe('collectSettings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns an object with version 1', () => {
    const data = collectSettings();
    expect(data.version).toBe(1);
  });

  it('includes an exportedAt ISO timestamp', () => {
    const data = collectSettings();
    expect(data.exportedAt).toBeTruthy();
    expect(() => new Date(data.exportedAt).toISOString()).not.toThrow();
  });

  it('collects non-bookmark keys as native JSON types', () => {
    setLocalStorage('kjv-theme', 'dark');
    setLocalStorage('kjv-verse-font-size', '1.5');
    setLocalStorage('kjv-strongs-enabled', '1');

    const data = collectSettings();
    // 'dark' is not valid JSON, so it stays as a string
    expect(data.keys['kjv-theme']).toBe('dark');
    // 1.5 parses as a number
    expect(data.keys['kjv-verse-font-size']).toBe(1.5);
    // '1' parses as a number
    expect(data.keys['kjv-strongs-enabled']).toBe(1);
  });

  it('collects the game-state key as a native JSON object', () => {
    setLocalStorage('kjv-game-state', JSON.stringify({
      xp: 1200, level: 4, comboBest: 7, unlockedRegionIds: ['r1'], builtRoads: [], settings: { sound: true, motion: true },
    }));
    const data = collectSettings();
    const gs = data.keys['kjv-game-state'] as { xp: number };
    expect(gs.xp).toBe(1200);
  });

  it('converts bookmark objects to a sorted array of reference strings', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Genesis 1:1' },
      { reference: 'Psalms 23:1' },
    ]));

    const data = collectSettings();
    const refs = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(refs).toEqual(['Genesis 1:1', 'Psalms 23:1', 'John 3:16']);
  });

  it('deduplicates bookmarks with the same reference', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Isaiah 26:4' },
      { reference: 'Isaiah 26:3' },
      { reference: 'Isaiah 26:4' }, // duplicate
      { reference: 'Isaiah 26:4' }, // duplicate
    ]));

    const data = collectSettings();
    const refs = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(refs).toEqual(['Isaiah 26:3', 'Isaiah 26:4']);
  });

  it('omits keys that are not set in localStorage', () => {
    setLocalStorage('kjv-theme', 'dark');
    const data = collectSettings();
    expect(data.keys['kjv-theme']).toBe('dark');
    expect(data.keys['kjv-memorize-bookmarks']).toBeUndefined();
  });

  it('returns empty keys when localStorage is empty', () => {
    const data = collectSettings();
    expect(Object.keys(data.keys)).toHaveLength(0);
  });

  it('collects all 11 keys when all are set', () => {
    for (const key of ALL_KJV_STORAGE_KEYS) {
      setLocalStorage(key, 'test-value');
    }
    const data = collectSettings();
    expect(Object.keys(data.keys)).toHaveLength(11);
  });

  it('exports empty bookmarks as "[]"', () => {
    setLocalStorage('kjv-memorize-bookmarks', '[]');
    const data = collectSettings();
    expect(data.keys['kjv-memorize-bookmarks']).toEqual([]);
  });

  it('handles bookmarks with extra fields (id, user, timestamps)', () => {
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([
      {
        id: 'abc123',
        user: { id: 'anonymous' },
        reference: 'John 3:16',
        addedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]));

    const data = collectSettings();
    const refs = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(refs).toEqual(['John 3:16']);
  });

  it('the exported bookmarks string is human-readable JSON', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Genesis 1:1' },
      { reference: 'John 3:16' },
    ]));

    const data = collectSettings();
    // The value should be a JSON array of strings, not objects
    const parsed = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(parsed.every((s: unknown) => typeof s === 'string')).toBe(true);
  });
});

// ─── downloadFilename ────────────────────────────────────────────────────────

describe('downloadFilename', () => {
  it('generates filename with YYYYMMDD format', () => {
    const date = new Date(2026, 6, 18);
    expect(downloadFilename(date)).toBe('kjv-ref-20260718.json');
  });

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5);
    expect(downloadFilename(date)).toBe('kjv-ref-20260105.json');
  });

  it('handles December 31 correctly', () => {
    const date = new Date(2026, 11, 31);
    expect(downloadFilename(date)).toBe('kjv-ref-20261231.json');
  });

  it('uses current date when no argument provided', () => {
    const filename = downloadFilename();
    expect(filename).toMatch(/^kjv-ref-\d{8}\.json$/);
  });
});

// ─── downloadSettings ───────────────────────────────────────────────────────

describe('downloadSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates an anchor element and triggers download', () => {
    setLocalStorage('kjv-theme', 'dark');
    downloadSettings();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('generates a download filename matching the YYYYMMDD pattern', () => {
    setLocalStorage('kjv-theme', 'dark');
    let capturedDownload = '';
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set(v: string) { capturedDownload = v; },
          get() { return capturedDownload; },
        });
      }
      return el;
    });

    downloadSettings();
    expect(capturedDownload).toMatch(/^kjv-ref-\d{8}\.json$/);
  });
});

// ─── Misspelling correction tests ────────────────────────────────────────────

describe('correctMisspelling', () => {
  it('corrects "Galations" to "Galatians"', () => {
    expect(correctMisspelling('Galations 2:20')).toBe('Galatians 2:20');
  });

  it('corrects "Psalm" to "Psalms"', () => {
    expect(correctMisspelling('Psalm 51:7')).toBe('Psalms 51:7');
  });

  it('corrects "Psalm" with verse range', () => {
    expect(correctMisspelling('Psalm 107:2')).toBe('Psalms 107:2');
  });

  it('corrects "Galations" with verse range', () => {
    expect(correctMisspelling('Galations 3:1-5')).toBe('Galatians 3:1-5');
  });

  it('does not change correctly spelled "Galatians"', () => {
    expect(correctMisspelling('Galatians 2:20')).toBe('Galatians 2:20');
  });

  it('does not change correctly spelled "Psalms"', () => {
    expect(correctMisspelling('Psalms 23:1')).toBe('Psalms 23:1');
  });

  it('does not change other book names', () => {
    expect(correctMisspelling('John 3:16')).toBe('John 3:16');
    expect(correctMisspelling('Genesis 1:1')).toBe('Genesis 1:1');
    expect(correctMisspelling('1 Corinthians 13:1-13')).toBe('1 Corinthians 13:1-13');
  });

  it('handles case-insensitive misspelling', () => {
    expect(correctMisspelling('galations 2:20')).toBe('Galatians 2:20');
    expect(correctMisspelling('PSALM 51:7')).toBe('Psalms 51:7');
  });

  it('returns unchanged for non-reference strings', () => {
    expect(correctMisspelling('not a reference')).toBe('not a reference');
    expect(correctMisspelling('')).toBe('');
  });
});

// ─── importSettings: bookmarks MERGE (additive) ──────────────────────────────

describe('importSettings: favorites (bookmarks) are merged, not replaced', () => {
  beforeEach(() => { localStorage.clear(); });

  it('imports new bookmarks (string array format) that do not exist locally', () => {
    const json = makeExportedSettings({ 'kjv-memorize-bookmarks': ['John 3:16', 'Psalms 23:1'] });
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(2);
    expect(result.skippedDuplicates).toBe(0);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
    expect(stored[0].reference).toBe('John 3:16');
    expect(stored[1].reference).toBe('Psalms 23:1');
  });

  it('generates internal bookmark objects with id/timestamps on import', () => {
    importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['John 3:16'] }));

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored[0]).toHaveProperty('id');
    expect(stored[0]).toHaveProperty('user');
    expect(stored[0].user).toEqual({ id: 'anonymous' });
    expect(stored[0]).toHaveProperty('addedAt');
    expect(stored[0]).toHaveProperty('createdAt');
    expect(stored[0]).toHaveProperty('updatedAt');
  });

  it('skips bookmarks that already exist locally (no overwrite of existing)', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
    ]));

    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['John 3:16', 'Psalms 23:1'] }));
    expect(result.addedBookmarks).toBe(1);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('skips all bookmarks when all already exist', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Psalms 23:1' },
    ]));

    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['John 3:16', 'Psalms 23:1'] }));
    expect(result.addedBookmarks).toBe(0);
    expect(result.skippedDuplicates).toBe(2);
  });

  it('imports all bookmarks when localStorage is empty', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Genesis 1:1', 'John 3:16', 'Romans 8:28'] }));
    expect(result.addedBookmarks).toBe(3);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('preserves existing bookmarks and appends new ones (does NOT replace)', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
    ]));

    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Psalms 23:1', 'Romans 8:28'] }));
    expect(result.addedBookmarks).toBe(2);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(3);
    expect(stored.map((b: any) => b.reference).sort()).toEqual([
      'John 3:16',  // pre-existing favorite is preserved
      'Psalms 23:1',
      'Romans 8:28',
    ]);
  });

  it('does not modify localStorage when no new bookmarks to add', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
    ]));
    const original = localStorage.getItem('kjv-memorize-bookmarks');

    importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['John 3:16'] }));
    expect(localStorage.getItem('kjv-memorize-bookmarks')).toBe(original);
  });

  it('dispatches storage change event when bookmarks are added', () => {
    const eventSpy = vi.fn();
    window.addEventListener('kjv-storage-change', eventSpy);

    importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['John 3:16'] }));

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const event = eventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.key).toBe('kjv-memorize-bookmarks');
    window.removeEventListener('kjv-storage-change', eventSpy);
  });

  it('does NOT dispatch storage change event when no bookmarks added', () => {
    const eventSpy = vi.fn();
    window.addEventListener('kjv-storage-change', eventSpy);

    importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': [] }));
    expect(eventSpy).not.toHaveBeenCalled();
    window.removeEventListener('kjv-storage-change', eventSpy);
  });

  it('skips invalid entries (non-string elements)', () => {
    const result = importSettings(makeExportedSettings({
      'kjv-memorize-bookmarks': ['John 3:16', 123, null, '', 'Psalms 23:1'] as unknown as string[],
    }));
    // Only valid string entries are counted; invalid ones are skipped
    expect(result.addedBookmarks).toBe(2);
    expect(result.skippedDuplicates).toBe(3);
  });

  it('handles large numbers of bookmarks', () => {
    const refs: string[] = [];
    for (let i = 1; i <= 100; i++) refs.push(`Book ${i}:1`);
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': refs }));
    expect(result.addedBookmarks).toBe(100);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('handles duplicate references in the imported file', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['John 3:16', 'John 3:16', 'Psalms 23:1'] }));
    expect(result.addedBookmarks).toBe(2);
    expect(result.skippedDuplicates).toBe(1);
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
  });

  it('generates unique IDs for imported bookmarks', () => {
    importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['John 3:16', 'Psalms 23:1'] }));
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    const ids = stored.map((b: any) => b.id);
    expect(new Set(ids).size).toBe(2);
  });

  // ── Misspelling correction on import ──

  it('imports "Galations 2:20" as "Galatians 2:20"', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Galations 2:20'] }));
    expect(result.addedBookmarks).toBe(1);
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored[0].reference).toBe('Galatians 2:20');
  });

  it('imports "Psalm 51:7" as "Psalms 51:7"', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Psalm 51:7'] }));
    expect(result.addedBookmarks).toBe(1);
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored[0].reference).toBe('Psalms 51:7');
  });

  it('imports multiple misspelled references with corrections', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': [
      'Galations 2:20', 'Galations 3:1-5', 'Psalm 51:7', 'Psalm 107:2',
    ]}));
    expect(result.addedBookmarks).toBe(4);
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored.map((b: any) => b.reference).sort()).toEqual([
      'Galatians 2:20', 'Galatians 3:1-5', 'Psalms 107:2', 'Psalms 51:7',
    ]);
  });

  it('deduplicates after misspelling correction', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Galations 2:20', 'Galatians 2:20'] }));
    expect(result.addedBookmarks).toBe(1);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('corrected misspelling matches existing bookmark', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([{ reference: 'Galatians 2:20' }]));
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Galations 2:20'] }));
    expect(result.addedBookmarks).toBe(0);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('imports correctly spelled references unchanged', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Galatians 2:20', 'Psalms 51:7'] }));
    expect(result.addedBookmarks).toBe(2);
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored.map((b: any) => b.reference).sort()).toEqual(['Galatians 2:20', 'Psalms 51:7']);
  });

  // ── Group bookmarks (verse ranges) ──

  it('imports group bookmarks from a settings file', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Psalms 23:1-6', 'John 3:16'] }));
    expect(result.addedBookmarks).toBe(2);
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored.map((b: any) => b.reference).sort()).toEqual(['John 3:16', 'Psalms 23:1-6']);
  });

  it('imports group bookmarks without duplicating existing ones', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([{ reference: 'Psalms 23:1-6' }]));
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': ['Psalms 23:1-6', 'John 3:16'] }));
    expect(result.addedBookmarks).toBe(1);
    expect(result.skippedDuplicates).toBe(1);
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
  });

  it('returns zeros when bookmarks array is empty', () => {
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-bookmarks': [] }));
    expect(result.addedBookmarks).toBe(0);
    expect(result.skippedDuplicates).toBe(0);
  });
});

// ─── importSettings: progress / schedule / sessions / prefs / game = REPLACE ─

describe('importSettings: progress and stats are replaced (mirrored from file)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('throws on invalid JSON', () => {
    expect(() => importSettings('not valid json')).toThrow();
  });

  it('throws on missing keys field', () => {
    expect(() => importSettings(JSON.stringify({ version: 1 }))).toThrow('missing "keys" field');
  });

  it('throws when keys is not an object', () => {
    expect(() => importSettings(JSON.stringify({ version: 1, keys: 'nope' }))).toThrow('missing "keys" field');
  });

  it('returns an empty summary when the file has no recognized keys', () => {
    const result = importSettings(makeExportedSettings({ 'unknown-key': 'whatever' }));
    expect(result.restoredKeys).toEqual([]);
    expect(result.progressCount).toBe(0);
    expect(result.bookmarkCount).toBe(0);
  });

  it('restores per-verse progress and reports the count', () => {
    const progress = [
      { verse: { reference: 'John 3:16' }, status: 'mastered', timesRecited: 10, streak: 9, accuracy: 100, customClozeLevel: 5 },
      { verse: { reference: 'Genesis 1:1' }, status: 'learning', timesRecited: 2, streak: 1, accuracy: 80, customClozeLevel: 1 },
    ];
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-progress': progress }));
    expect(result.restoredKeys).toContain('kjv-memorize-progress');
    expect(result.progressCount).toBe(2);
    expect(JSON.parse(localStorage.getItem('kjv-memorize-progress')!)).toEqual(progress);
  });

  it('restores the review schedule and reports the count', () => {
    const schedule = [{ verse: { reference: 'John 3:16' }, dueDate: '2026-08-02T00:00:00.000Z', interval: 3 }];
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-review-schedule': schedule }));
    expect(result.scheduleCount).toBe(1);
    expect(JSON.parse(localStorage.getItem('kjv-memorize-review-schedule')!)).toEqual(schedule);
  });

  it('restores sessions and reports the count', () => {
    const sessions = [{ id: 's1', date: '2026-07-26', mode: 'game' }];
    const result = importSettings(makeExportedSettings({ 'kjv-memorize-sessions': sessions }));
    expect(result.sessionCount).toBe(1);
    expect(JSON.parse(localStorage.getItem('kjv-memorize-sessions')!)).toEqual(sessions);
  });

  it('restores achievements, daily goal, and game state', () => {
    const result = importSettings(makeExportedSettings({
      'kjv-memorize-achievements': [{ id: 'a1', unlocked: true }],
      'kjv-memorize-daily-goal': { date: '2026-07-26', targetVerses: 5, completedVerses: 5, completed: true },
      'kjv-game-state': { xp: 1500, level: 5, comboBest: 9, unlockedRegionIds: ['r1', 'r2'], builtRoads: [], settings: { sound: true, motion: true } },
    }));
    expect(result.restoredKeys).toEqual(expect.arrayContaining([
      'kjv-memorize-achievements', 'kjv-memorize-daily-goal', 'kjv-game-state',
    ]));
    expect(JSON.parse(localStorage.getItem('kjv-memorize-achievements')!)).toEqual([{ id: 'a1', unlocked: true }]);
    expect(JSON.parse(localStorage.getItem('kjv-game-state')!).xp).toBe(1500);
  });

  it('restores UI preference keys (theme stored verbatim, numbers stringified)', () => {
    const result = importSettings(makeExportedSettings({
      'kjv-theme': 'dark',
      'kjv-verse-font-size': 1.5,
      'kjv-strongs-enabled': 1,
      'kjv-interlinear-enabled': 0,
    }));
    expect(result.restoredKeys).toEqual(expect.arrayContaining([
      'kjv-theme', 'kjv-verse-font-size', 'kjv-strongs-enabled', 'kjv-interlinear-enabled',
    ]));
    // Theme is a plain string, stored verbatim (NOT JSON-stringified to '"dark"').
    expect(localStorage.getItem('kjv-theme')).toBe('dark');
    // Numbers are JSON-stringified back to their localStorage form.
    expect(localStorage.getItem('kjv-verse-font-size')).toBe('1.5');
    expect(localStorage.getItem('kjv-strongs-enabled')).toBe('1');
    expect(localStorage.getItem('kjv-interlinear-enabled')).toBe('0');
  });

  it('ignores unknown keys in the file (does not pollute localStorage)', () => {
    importSettings(makeExportedSettings({ 'kjv-theme': 'dark', 'some-unknown-key': 'malicious' }));
    expect(localStorage.getItem('kjv-theme')).toBe('dark');
    expect(localStorage.getItem('some-unknown-key')).toBeNull();
  });

  it('dispatches a storage-change event for each replaced (non-bookmark) key', () => {
    const eventSpy = vi.fn();
    window.addEventListener('kjv-storage-change', eventSpy);

    importSettings(makeExportedSettings({
      'kjv-theme': 'dark',
      'kjv-memorize-progress': [{ verse: { reference: 'John 3:16' }, status: 'mastered' }],
    }));

    expect(eventSpy).toHaveBeenCalledTimes(2);
    const keys = eventSpy.mock.calls.map((c: any[]) => (c[0] as CustomEvent).detail.key);
    expect(keys).toEqual(expect.arrayContaining(['kjv-theme', 'kjv-memorize-progress']));
    window.removeEventListener('kjv-storage-change', eventSpy);
  });

  it('overwrites (replaces) pre-existing local progress with the imported snapshot', () => {
    // Local device has different progress that must be fully replaced.
    setLocalStorage('kjv-memorize-progress', JSON.stringify([
      { verse: { reference: 'Romans 8:28' }, status: 'reviewing', timesRecited: 4 },
    ]));

    const result = importSettings(makeExportedSettings({
      'kjv-memorize-progress': [
        { verse: { reference: 'John 3:16' }, status: 'mastered', timesRecited: 10 },
      ],
    }));

    expect(result.progressCount).toBe(1);
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-progress')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].verse.reference).toBe('John 3:16');
    // The local-only progress is gone (replace, not merge).
    expect(stored.find((e: any) => e.verse.reference === 'Romans 8:28')).toBeUndefined();
  });

  it('handles a full snapshot with all keys at once', () => {
    const result = importSettings(makeExportedSettings({
      'kjv-theme': 'dark',
      'kjv-verse-font-size': 1.25,
      'kjv-strongs-enabled': 1,
      'kjv-interlinear-enabled': 0,
      'kjv-memorize-progress': [{ verse: { reference: 'John 3:16' }, status: 'mastered', timesRecited: 10, streak: 9, accuracy: 100, customClozeLevel: 5 }],
      'kjv-memorize-sessions': [{ id: 's1' }],
      'kjv-memorize-achievements': [{ id: 'a1' }],
      'kjv-memorize-bookmarks': ['John 3:16', 'Genesis 1:1'],
      'kjv-memorize-daily-goal': { date: '2026-07-26', completed: true },
      'kjv-memorize-review-schedule': [{ verse: { reference: 'John 3:16' }, dueDate: '2026-08-02T00:00:00.000Z', interval: 3 }],
      'kjv-game-state': { xp: 2000, level: 6, comboBest: 12, unlockedRegionIds: [], builtRoads: [], settings: { sound: false, motion: true } },
    }));

    expect(result.restoredKeys).toHaveLength(11);
    expect(result.progressCount).toBe(1);
    expect(result.bookmarkCount).toBe(2);
    expect(result.addedBookmarks).toBe(2);
    expect(result.scheduleCount).toBe(1);
    expect(result.sessionCount).toBe(1);
    // Every recognized key is present in localStorage now.
    for (const key of ALL_KJV_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).not.toBeNull();
    }
  });
});

// ─── Round-trip tests (export → clear → import) ──────────────────────────────

describe('Export → Import round-trip', () => {
  beforeEach(() => { localStorage.clear(); });

  it('exporting then importing into a fresh browser restores everything', () => {
    setLocalStorage('kjv-theme', 'dark');
    setLocalStorage('kjv-verse-font-size', '1.5');
    setLocalStorage('kjv-strongs-enabled', '1');
    setLocalStorage('kjv-memorize-progress', JSON.stringify([
      { verse: { reference: 'John 3:16' }, status: 'mastered', timesRecited: 10, streak: 9, accuracy: 100, customClozeLevel: 5 },
      { verse: { reference: 'Genesis 1:1' }, status: 'learning', timesRecited: 2, streak: 1, accuracy: 80, customClozeLevel: 1 },
    ]));
    setLocalStorage('kjv-memorize-review-schedule', JSON.stringify([
      { verse: { reference: 'John 3:16' }, dueDate: '2026-08-02T00:00:00.000Z', interval: 3 },
    ]));
    setLocalStorage('kjv-memorize-sessions', JSON.stringify([{ id: 's1', date: '2026-07-26' }]));
    setLocalStorage('kjv-game-state', JSON.stringify({ xp: 2000, level: 6, comboBest: 12, unlockedRegionIds: ['r1'], builtRoads: [], settings: { sound: true, motion: true } }));
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Psalms 23:1' },
    ]));

    // Export
    const exported = collectSettings();
    const json = JSON.stringify(exported);

    // Verify the exported bookmarks are reference strings, sorted in Bible order.
    const exportedRefs = exported.keys['kjv-memorize-bookmarks'] as string[];
    expect(exportedRefs).toEqual(['Psalms 23:1', 'John 3:16']);
    expect(exportedRefs.every((s: unknown) => typeof s === 'string')).toBe(true);

    // Simulate a fresh browser.
    localStorage.clear();

    // Import
    const result = importSettings(json);
    expect(result.restoredKeys.length).toBeGreaterThan(0);
    expect(result.progressCount).toBe(2);
    expect(result.addedBookmarks).toBe(2);
    expect(result.scheduleCount).toBe(1);
    expect(result.sessionCount).toBe(1);

    // Progress is fully restored with all training stats intact.
    const progress = JSON.parse(localStorage.getItem('kjv-memorize-progress')!);
    expect(progress).toHaveLength(2);
    const john = progress.find((e: any) => e.verse.reference === 'John 3:16');
    expect(john.status).toBe('mastered');
    expect(john.timesRecited).toBe(10);
    expect(john.streak).toBe(9);
    expect(john.accuracy).toBe(100);
    expect(john.customClozeLevel).toBe(5);

    // Review schedule restored.
    const schedule = JSON.parse(localStorage.getItem('kjv-memorize-review-schedule')!);
    expect(schedule[0].verse.reference).toBe('John 3:16');
    expect(schedule[0].dueDate).toBe('2026-08-02T00:00:00.000Z');

    // Game state restored.
    const gs = JSON.parse(localStorage.getItem('kjv-game-state')!);
    expect(gs.xp).toBe(2000);
    expect(gs.unlockedRegionIds).toEqual(['r1']);

    // Bookmarks restored (fresh browser → all added by merge).
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored.map((b: any) => b.reference).sort()).toEqual(['John 3:16', 'Psalms 23:1']);
  });

  it('importing a new snapshot onto a device with different data replaces progress but MERGES favorites', () => {
    // Browser A (desktop) snapshot.
    setLocalStorage('kjv-memorize-progress', JSON.stringify([
      { verse: { reference: 'John 3:16' }, status: 'mastered', timesRecited: 10 },
    ]));
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([{ reference: 'John 3:16' }]));
    const exported = collectSettings();
    const json = JSON.stringify(exported);

    // Browser B (mobile) already has different progress + a different favorite.
    localStorage.clear();
    setLocalStorage('kjv-memorize-progress', JSON.stringify([
      { verse: { reference: 'Romans 8:28' }, status: 'reviewing', timesRecited: 4 },
    ]));
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([{ reference: 'Romans 8:28' }]));

    const result = importSettings(json);
    expect(result.progressCount).toBe(1);
    expect(result.addedBookmarks).toBe(1); // John 3:16 is new on mobile
    expect(result.skippedDuplicates).toBe(0);

    // Progress is REPLACED: Romans 8:28 gone, John 3:16 present.
    const progress = JSON.parse(localStorage.getItem('kjv-memorize-progress')!);
    expect(progress).toHaveLength(1);
    expect(progress[0].verse.reference).toBe('John 3:16');
    expect(progress.find((e: any) => e.verse.reference === 'Romans 8:28')).toBeUndefined();

    // Favorites are MERGED: the mobile's Romans 8:28 is kept, desktop's John 3:16 added.
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored.map((b: any) => b.reference).sort()).toEqual(['John 3:16', 'Romans 8:28']);
  });

  it('exported file with deduplicated bookmarks imports cleanly', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Isaiah 26:3' },
      { reference: 'Isaiah 26:4' },
      { reference: 'Isaiah 26:4' }, // duplicate
      { reference: 'Isaiah 26:4' }, // duplicate
    ]));

    const exported = collectSettings();
    const exportedRefs = exported.keys['kjv-memorize-bookmarks'] as string[];
    expect(exportedRefs).toEqual(['Isaiah 26:3', 'Isaiah 26:4']);

    localStorage.clear();
    const result = importSettings(JSON.stringify(exported));
    expect(result.addedBookmarks).toBe(2);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored.map((b: any) => b.reference).sort()).toEqual(['Isaiah 26:3', 'Isaiah 26:4']);
  });
});

// ─── Group bookmark (verse range) export tests ───────────────────────────────

describe('Group bookmarks (verse ranges) export', () => {
  beforeEach(() => { localStorage.clear(); });

  it('exports group bookmarks as reference strings like "Psalms 23:1-6"', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Psalms 23:1-6' },
      { reference: 'John 3:16' },
    ]));

    const data = collectSettings();
    const refs = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(refs).toContain('Psalms 23:1-6');
    expect(refs).toContain('John 3:16');
  });

  it('sorts group bookmarks alongside single-verse bookmarks in Bible order', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Psalms 23:1-6' },
      { reference: 'Genesis 1:1' },
    ]));

    const data = collectSettings();
    const refs = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(refs).toEqual(['Genesis 1:1', 'Psalms 23:1-6', 'John 3:16']);
  });

  it('deduplicates group bookmarks with the same reference', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Psalms 23:1-6' },
      { reference: 'Psalms 23:1-6' },
    ]));

    const data = collectSettings();
    const refs = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(refs).toEqual(['Psalms 23:1-6']);
  });

  it('group and single-verse bookmarks for the same chapter coexist', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Psalms 23:1' },
      { reference: 'Psalms 23:1-6' },
    ]));

    const data = collectSettings();
    const refs = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(refs).toContain('Psalms 23:1');
    expect(refs).toContain('Psalms 23:1-6');
    expect(refs).toHaveLength(2);
  });

  it('round-trip: export group bookmarks → clear → import restores them', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Psalms 23:1-6' },
      { reference: 'Romans 8:28-39' },
      { reference: 'John 3:16' },
    ]));

    const exported = collectSettings();
    const json = JSON.stringify(exported);

    localStorage.clear();
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(3);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    const refs = stored.map((b: any) => b.reference).sort();
    expect(refs).toEqual(['John 3:16', 'Psalms 23:1-6', 'Romans 8:28-39']);
  });

  it('exports and sorts multiple group bookmarks correctly', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Romans 8:28-39' },
      { reference: 'Psalms 23:1-6' },
      { reference: '1 Corinthians 13:1-13' },
      { reference: 'Genesis 1:1-3' },
    ]));

    const data = collectSettings();
    const refs = data.keys['kjv-memorize-bookmarks'] as string[];
    expect(refs).toEqual([
      'Genesis 1:1-3',
      'Psalms 23:1-6',
      'Romans 8:28-39',
      '1 Corinthians 13:1-13',
    ]);
  });
});