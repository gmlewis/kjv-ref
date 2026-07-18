import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  collectSettings,
  downloadFilename,
  downloadSettings,
  importSettings,
  sortReferences,
  parseRef,
  ALL_KJV_STORAGE_KEYS,
  type ExportedSettings,
} from './settingsTransfer';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function setLocalStorage(key: string, value: string) {
  localStorage.setItem(key, value);
}

/** Build an export JSON string with the new format (array of reference strings) */
function makeExportedSettings(bookmarks: string[]): string {
  const data: ExportedSettings = {
    version: 1,
    exportedAt: '2026-07-18T12:00:00.000Z',
    keys: {
      'kjv-memorize-bookmarks': JSON.stringify(bookmarks),
    },
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
  it('includes all 10 known localStorage keys', () => {
    expect(ALL_KJV_STORAGE_KEYS).toHaveLength(10);
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

  it('collects non-bookmark keys as-is', () => {
    setLocalStorage('kjv-theme', 'dark');
    setLocalStorage('kjv-verse-font-size', '1.5');
    setLocalStorage('kjv-strongs-enabled', '1');

    const data = collectSettings();
    expect(data.keys['kjv-theme']).toBe('dark');
    expect(data.keys['kjv-verse-font-size']).toBe('1.5');
    expect(data.keys['kjv-strongs-enabled']).toBe('1');
  });

  it('converts bookmark objects to a sorted array of reference strings', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Genesis 1:1' },
      { reference: 'Psalms 23:1' },
    ]));

    const data = collectSettings();
    const refs = JSON.parse(data.keys['kjv-memorize-bookmarks']);
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
    const refs = JSON.parse(data.keys['kjv-memorize-bookmarks']);
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

  it('collects all 10 keys when all are set', () => {
    for (const key of ALL_KJV_STORAGE_KEYS) {
      setLocalStorage(key, 'test-value');
    }
    const data = collectSettings();
    expect(Object.keys(data.keys)).toHaveLength(10);
  });

  it('exports empty bookmarks as "[]"', () => {
    setLocalStorage('kjv-memorize-bookmarks', '[]');
    const data = collectSettings();
    expect(data.keys['kjv-memorize-bookmarks']).toBe('[]');
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
    const refs = JSON.parse(data.keys['kjv-memorize-bookmarks']);
    expect(refs).toEqual(['John 3:16']);
  });

  it('the exported bookmarks string is human-readable JSON', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Genesis 1:1' },
      { reference: 'John 3:16' },
    ]));

    const data = collectSettings();
    // The value should be a JSON array of strings, not objects
    const parsed = JSON.parse(data.keys['kjv-memorize-bookmarks']);
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

// ─── importSettings ──────────────────────────────────────────────────────────

describe('importSettings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('imports new bookmarks (string array format) that do not exist locally', () => {
    const json = makeExportedSettings(['John 3:16', 'Psalms 23:1']);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(2);
    expect(result.skippedDuplicates).toBe(0);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
    expect(stored[0].reference).toBe('John 3:16');
    expect(stored[1].reference).toBe('Psalms 23:1');
  });

  it('generates internal bookmark objects with id/timestamps on import', () => {
    const json = makeExportedSettings(['John 3:16']);
    importSettings(json);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored[0]).toHaveProperty('id');
    expect(stored[0]).toHaveProperty('user');
    expect(stored[0].user).toEqual({ id: 'anonymous' });
    expect(stored[0]).toHaveProperty('addedAt');
    expect(stored[0]).toHaveProperty('createdAt');
    expect(stored[0]).toHaveProperty('updatedAt');
  });

  it('skips bookmarks that already exist locally', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
    ]));

    const json = makeExportedSettings(['John 3:16', 'Psalms 23:1']);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(1);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('skips all bookmarks when all already exist', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Psalms 23:1' },
    ]));

    const json = makeExportedSettings(['John 3:16', 'Psalms 23:1']);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(0);
    expect(result.skippedDuplicates).toBe(2);
  });

  it('imports all bookmarks when localStorage is empty', () => {
    const json = makeExportedSettings(['Genesis 1:1', 'John 3:16', 'Romans 8:28']);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(3);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('returns zeros when file has no bookmarks key', () => {
    const data: ExportedSettings = {
      version: 1,
      exportedAt: '2026-07-18T12:00:00.000Z',
      keys: {},
    };
    const result = importSettings(JSON.stringify(data));
    expect(result.addedBookmarks).toBe(0);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('returns zeros when bookmarks array is empty', () => {
    const json = makeExportedSettings([]);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(0);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('does not modify localStorage when no new bookmarks to add', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
    ]));
    const original = localStorage.getItem('kjv-memorize-bookmarks');

    const json = makeExportedSettings(['John 3:16']);
    importSettings(json);

    expect(localStorage.getItem('kjv-memorize-bookmarks')).toBe(original);
  });

  it('dispatches storage change event when bookmarks are added', () => {
    const eventSpy = vi.fn();
    window.addEventListener('kjv-storage-change', eventSpy);

    const json = makeExportedSettings(['John 3:16']);
    importSettings(json);

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const event = eventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.key).toBe('kjv-memorize-bookmarks');
    window.removeEventListener('kjv-storage-change', eventSpy);
  });

  it('does NOT dispatch storage change event when no bookmarks added', () => {
    const eventSpy = vi.fn();
    window.addEventListener('kjv-storage-change', eventSpy);

    const json = makeExportedSettings([]);
    importSettings(json);

    expect(eventSpy).not.toHaveBeenCalled();
    window.removeEventListener('kjv-storage-change', eventSpy);
  });

  it('preserves existing bookmarks and appends new ones', () => {
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
    ]));

    const json = makeExportedSettings(['Psalms 23:1', 'Romans 8:28']);
    importSettings(json);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(3);
    expect(stored.map((b: any) => b.reference).sort()).toEqual([
      'John 3:16',
      'Psalms 23:1',
      'Romans 8:28',
    ]);
  });

  it('skips invalid entries (non-string elements)', () => {
    const data: ExportedSettings = {
      version: 1,
      exportedAt: '2026-07-18T00:00:00.000Z',
      keys: {
        'kjv-memorize-bookmarks': JSON.stringify(['John 3:16', 123, null, '', 'Psalms 23:1']),
      },
    };
    const result = importSettings(JSON.stringify(data));
    // Only valid string entries are counted; invalid ones are skipped
    expect(result.addedBookmarks).toBe(2);
    expect(result.skippedDuplicates).toBe(3);
  });

  it('throws on invalid JSON', () => {
    expect(() => importSettings('not valid json')).toThrow();
  });

  it('throws on missing keys field', () => {
    expect(() => importSettings(JSON.stringify({ version: 1 }))).toThrow('missing "keys" field');
  });

  it('does NOT import non-bookmark keys (only bookmarks are imported)', () => {
    const data: ExportedSettings = {
      version: 1,
      exportedAt: '2026-07-18T12:00:00.000Z',
      keys: {
        'kjv-theme': 'dark',
        'kjv-memorize-progress': JSON.stringify([{ reference: 'John 3:16', status: 'mastered' }]),
        'kjv-memorize-bookmarks': JSON.stringify(['John 3:16']),
      },
    };
    const result = importSettings(JSON.stringify(data));
    expect(result.addedBookmarks).toBe(1);
    expect(localStorage.getItem('kjv-theme')).toBeNull();
    expect(localStorage.getItem('kjv-memorize-progress')).toBeNull();
    expect(localStorage.getItem('kjv-memorize-bookmarks')).not.toBeNull();
  });

  it('handles large numbers of bookmarks', () => {
    const refs: string[] = [];
    for (let i = 1; i <= 100; i++) {
      refs.push(`Book ${i}:1`);
    }
    const json = makeExportedSettings(refs);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(100);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('handles duplicate references in the imported file', () => {
    const json = makeExportedSettings(['John 3:16', 'John 3:16', 'Psalms 23:1']);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(2);
    expect(result.skippedDuplicates).toBe(1);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
  });

  it('generates unique IDs for imported bookmarks', () => {
    const json = makeExportedSettings(['John 3:16', 'Psalms 23:1']);
    importSettings(json);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    const ids = stored.map((b: any) => b.id);
    expect(new Set(ids).size).toBe(2);
  });
});

// ─── Round-trip tests ─────────────────────────────────────────────────────────

describe('Export → Import round-trip', () => {
  beforeEach(() => { localStorage.clear(); });

  it('exported file can be re-imported to restore bookmarks on a fresh browser', () => {
    // Set up bookmarks with full object format
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Psalms 23:1' },
    ]));
    setLocalStorage('kjv-theme', 'dark');

    // Export
    const exported = collectSettings();
    const json = JSON.stringify(exported);

    // Verify the exported bookmarks are reference strings, not objects
    const exportedRefs = JSON.parse(exported.keys['kjv-memorize-bookmarks']);
    expect(exportedRefs).toEqual(['Psalms 23:1', 'John 3:16']);
    expect(exportedRefs.every((s: unknown) => typeof s === 'string')).toBe(true);

    // Clear localStorage (simulate fresh browser)
    localStorage.clear();

    // Import
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(2);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
    expect(stored.map((b: any) => b.reference).sort()).toEqual(['John 3:16', 'Psalms 23:1']);
  });

  it('imported bookmarks merge with existing ones without duplicates', () => {
    // Browser A has bookmarks
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Genesis 1:1' },
    ]));
    const exported = collectSettings();
    const json = JSON.stringify(exported);

    // Browser B already has one of the same bookmarks plus a different one
    localStorage.clear();
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'John 3:16' },
      { reference: 'Romans 8:28' },
    ]));

    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(1); // only Genesis 1:1 is new
    expect(result.skippedDuplicates).toBe(1); // John 3:16 already exists

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(3);
    expect(stored.map((b: any) => b.reference).sort()).toEqual([
      'Genesis 1:1',
      'John 3:16',
      'Romans 8:28',
    ]);
  });

  it('exported file with deduplicated bookmarks imports cleanly', () => {
    // Start with duplicates in localStorage
    setLocalStorage('kjv-memorize-bookmarks', makeBookmarkObjects([
      { reference: 'Isaiah 26:3' },
      { reference: 'Isaiah 26:4' },
      { reference: 'Isaiah 26:4' }, // duplicate
      { reference: 'Isaiah 26:4' }, // duplicate
    ]));

    // Export should deduplicate
    const exported = collectSettings();
    const exportedRefs = JSON.parse(exported.keys['kjv-memorize-bookmarks']);
    expect(exportedRefs).toEqual(['Isaiah 26:3', 'Isaiah 26:4']);

    // Import into fresh browser
    localStorage.clear();
    const result = importSettings(JSON.stringify(exported));
    expect(result.addedBookmarks).toBe(2);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
    expect(stored.map((b: any) => b.reference).sort()).toEqual(['Isaiah 26:3', 'Isaiah 26:4']);
  });
});