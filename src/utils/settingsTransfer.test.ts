import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  collectSettings,
  downloadFilename,
  downloadSettings,
  importSettings,
  ALL_KJV_STORAGE_KEYS,
  type ExportedSettings,
} from './settingsTransfer';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function setLocalStorage(key: string, value: string) {
  localStorage.setItem(key, value);
}

function makeExportedSettings(bookmarks: Array<{ reference: string; addedAt?: string }>): string {
  const data: ExportedSettings = {
    version: 1,
    exportedAt: '2026-07-18T12:00:00.000Z',
    keys: {
      'kjv-memorize-bookmarks': JSON.stringify(bookmarks),
    },
  };
  return JSON.stringify(data, null, 2);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

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

  it('collects all localStorage keys that are set', () => {
    setLocalStorage('kjv-theme', 'dark');
    setLocalStorage('kjv-verse-font-size', '1.5');
    setLocalStorage('kjv-strongs-enabled', '1');
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([{ reference: 'John 3:16', addedAt: '2026-01-01' }]));

    const data = collectSettings();
    expect(data.keys['kjv-theme']).toBe('dark');
    expect(data.keys['kjv-verse-font-size']).toBe('1.5');
    expect(data.keys['kjv-strongs-enabled']).toBe('1');
    expect(JSON.parse(data.keys['kjv-memorize-bookmarks'])).toEqual([{ reference: 'John 3:16', addedAt: '2026-01-01' }]);
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
});

describe('downloadFilename', () => {
  it('generates filename with YYYYMMDD format', () => {
    const date = new Date(2026, 6, 18); // July 18, 2026 (month is 0-indexed)
    expect(downloadFilename(date)).toBe('kjv-ref-20260718.json');
  });

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5); // January 5, 2026
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

describe('downloadSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    // Mock URL.createObjectURL/revokeObjectURL
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

  it('creates an anchor element and clicks it to trigger download', () => {
    setLocalStorage('kjv-theme', 'dark');
    downloadSettings();

    // Verify URL.createObjectURL was called
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('generates a download filename matching the YYYYMMDD pattern', () => {
    setLocalStorage('kjv-theme', 'dark');
    // Mock createElement to capture the download attribute
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

describe('importSettings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('imports new bookmarks that do not exist locally', () => {
    const json = makeExportedSettings([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
      { reference: 'Psalms 23:1', addedAt: '2026-01-02' },
    ]);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(2);
    expect(result.skippedDuplicates).toBe(0);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
    expect(stored[0].reference).toBe('John 3:16');
    expect(stored[1].reference).toBe('Psalms 23:1');
  });

  it('skips bookmarks that already exist locally', () => {
    // Pre-populate with one bookmark
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
    ]));

    const json = makeExportedSettings([
      { reference: 'John 3:16', addedAt: '2026-01-01' }, // duplicate
      { reference: 'Psalms 23:1', addedAt: '2026-01-02' }, // new
    ]);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(1);
    expect(result.skippedDuplicates).toBe(1);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
  });

  it('skips all bookmarks when all already exist', () => {
    const existing = [
      { reference: 'John 3:16', addedAt: '2026-01-01' },
      { reference: 'Psalms 23:1', addedAt: '2026-01-02' },
    ];
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify(existing));

    const json = makeExportedSettings(existing);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(0);
    expect(result.skippedDuplicates).toBe(2);
  });

  it('imports all bookmarks when localStorage is empty', () => {
    const json = makeExportedSettings([
      { reference: 'Genesis 1:1', addedAt: '2026-01-01' },
      { reference: 'John 3:16', addedAt: '2026-01-02' },
      { reference: 'Romans 8:28', addedAt: '2026-01-03' },
    ]);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(3);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('returns zeros when file has no bookmarks', () => {
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
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
    ]));
    const original = localStorage.getItem('kjv-memorize-bookmarks');

    const json = makeExportedSettings([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
    ]);
    importSettings(json);

    expect(localStorage.getItem('kjv-memorize-bookmarks')).toBe(original);
  });

  it('dispatches storage change event when bookmarks are added', () => {
    const eventSpy = vi.fn();
    window.addEventListener('kjv-storage-change', eventSpy);

    const json = makeExportedSettings([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
    ]);
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
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
    ]));

    const json = makeExportedSettings([
      { reference: 'Psalms 23:1', addedAt: '2026-01-02' },
      { reference: 'Romans 8:28', addedAt: '2026-01-03' },
    ]);
    importSettings(json);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(3);
    expect(stored.map((b: any) => b.reference)).toEqual([
      'John 3:16',
      'Psalms 23:1',
      'Romans 8:28',
    ]);
  });

  it('handles bookmarks with extra fields (id, etc.)', () => {
    const json = makeExportedSettings([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
    ]);
    // Manually create JSON with extra fields
    const data = JSON.parse(json);
    data.keys['kjv-memorize-bookmarks'] = JSON.stringify([
      { reference: 'John 3:16', addedAt: '2026-01-01', id: 'abc123' },
    ]);
    const result = importSettings(JSON.stringify(data));
    expect(result.addedBookmarks).toBe(1);

    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored[0].id).toBe('abc123');
  });

  it('skips bookmarks without a reference field', () => {
    const json = makeExportedSettings([
      { reference: 'John 3:16' },
      { addedAt: '2026-01-01' } as any, // no reference
    ]);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(1);
    expect(result.skippedDuplicates).toBe(1);
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
        'kjv-memorize-bookmarks': JSON.stringify([{ reference: 'John 3:16' }]),
      },
    };
    const result = importSettings(JSON.stringify(data));
    expect(result.addedBookmarks).toBe(1);
    // Non-bookmark keys should NOT be written to localStorage
    expect(localStorage.getItem('kjv-theme')).toBeNull();
    expect(localStorage.getItem('kjv-memorize-progress')).toBeNull();
    // Only bookmarks should be stored
    expect(localStorage.getItem('kjv-memorize-bookmarks')).not.toBeNull();
  });

  it('handles large numbers of bookmarks', () => {
    const many: Array<{ reference: string; addedAt: string }> = [];
    for (let i = 1; i <= 100; i++) {
      many.push({ reference: `Book ${i}:1`, addedAt: `2026-01-${String(i).padStart(2, '0')}` });
    }
    const json = makeExportedSettings(many);
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(100);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('handles bookmarks with the same reference but different addedAt', () => {
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
    ]));

    const json = makeExportedSettings([
      { reference: 'John 3:16', addedAt: '2026-06-01' }, // same ref, different date
    ]);
    const result = importSettings(json);
    // Should be treated as duplicate (same reference)
    expect(result.addedBookmarks).toBe(0);
    expect(result.skippedDuplicates).toBe(1);
  });
});

// ─── Round-trip tests ─────────────────────────────────────────────────────────

describe('Export → Import round-trip', () => {
  beforeEach(() => { localStorage.clear(); });

  it('exported file can be re-imported to restore bookmarks on a fresh browser', () => {
    // Set up bookmarks
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
      { reference: 'Psalms 23:1', addedAt: '2026-01-02' },
    ]));
    setLocalStorage('kjv-theme', 'dark');
    setLocalStorage('kjv-verse-font-size', '1.5');

    // Export
    const exported = collectSettings();
    const json = JSON.stringify(exported);

    // Clear localStorage (simulate fresh browser)
    localStorage.clear();

    // Import
    const result = importSettings(json);
    expect(result.addedBookmarks).toBe(2);

    // Bookmarks should be restored
    const stored = JSON.parse(localStorage.getItem('kjv-memorize-bookmarks')!);
    expect(stored).toHaveLength(2);
    expect(stored.map((b: any) => b.reference).sort()).toEqual(['John 3:16', 'Psalms 23:1']);
  });

  it('imported bookmarks merge with existing ones without duplicates', () => {
    // Browser A has bookmarks
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
      { reference: 'Genesis 1:1', addedAt: '2026-01-02' },
    ]));
    const exported = collectSettings();
    const json = JSON.stringify(exported);

    // Browser B already has one of the same bookmarks plus a different one
    localStorage.clear();
    setLocalStorage('kjv-memorize-bookmarks', JSON.stringify([
      { reference: 'John 3:16', addedAt: '2026-01-01' },
      { reference: 'Romans 8:28', addedAt: '2026-01-03' },
    ]));

    // Import A's settings into B
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
});