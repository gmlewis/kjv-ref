import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression tests: a transient fetch failure must NOT permanently poison the
// lazy singleton. Each loader caches its in-flight promise; if the promise
// rejects and the cache is never cleared, every later call returns the same
// rejected promise (the app stays broken for that data source until reload).
// Each test gets a fresh module instance via vi.resetModules() so the
// module-level caches start clean.

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('lazy data loaders retry after a transient fetch failure', () => {
  it('getKJVChapter (bible) retries after fetch rejects', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { getKJVChapter } = await import('./kjv-bible');
    await expect(getKJVChapter('Genesis', 1)).rejects.toThrow('network');

    // Restore a working fetch and confirm the loader retries instead of
    // returning the cached rejection.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'Ge1:1 In the beginning God created the heaven and the earth.',
    }));
    const verses = await getKJVChapter('Genesis', 1);
    expect(verses.length).toBe(1);
    expect(verses[0].text).toContain('In the beginning');
  });

  it('getInterlinearHebrew retries after fetch rejects', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { getInterlinearHebrew } = await import('./interlinear');
    await expect(getInterlinearHebrew()).rejects.toThrow('network');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'Psa.23.1': 'יְהוָה רֹעִי' }),
    }));
    const data = await getInterlinearHebrew();
    expect(data).toEqual({ 'Psa.23.1': 'יְהוָה רֹעִי' });
  });

  it('getInterlinearGreek retries after fetch rejects', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { getInterlinearGreek } = await import('./interlinear');
    await expect(getInterlinearGreek()).rejects.toThrow('network');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'John.3.16': 'οὕτως' }),
    }));
    const data = await getInterlinearGreek();
    expect(data).toEqual({ 'John.3.16': 'οὕτως' });
  });

  it('getWordIndex retries after fetch rejects', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { getWordIndex } = await import('./strongs');
    await expect(getWordIndex()).rejects.toThrow('network');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'Ge.1.1': ['H7225', 'H1254'] }),
    }));
    const data = await getWordIndex();
    expect(data).toEqual({ 'Ge.1.1': ['H7225', 'H1254'] });
  });

  it('getHebrewLexicon retries after fetch rejects', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { getHebrewLexicon } = await import('./strongs');
    await expect(getHebrewLexicon()).rejects.toThrow('network');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ H7225: { lemma: 'רֵאשִׁית' } }),
    }));
    const data = await getHebrewLexicon();
    expect(data).toEqual({ H7225: { lemma: 'רֵאשִׁית' } });
  });

  it('getGreekLexicon retries after fetch rejects', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { getGreekLexicon } = await import('./strongs');
    await expect(getGreekLexicon()).rejects.toThrow('network');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ G2316: { lemma: 'θεός' } }),
    }));
    const data = await getGreekLexicon();
    expect(data).toEqual({ G2316: { lemma: 'θεός' } });
  });
});