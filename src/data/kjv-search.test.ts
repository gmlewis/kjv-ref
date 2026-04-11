import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { _setBibleForTesting } from './kjv-bible';
import { searchKJV, type SearchResult } from './kjv-search';

// 1.2.1 — Load kjv.txt and inject it for tests so no fetch is needed
beforeAll(() => {
  const raw = readFileSync('public/kjv.txt', 'utf8');
  _setBibleForTesting(raw);
});

describe('searchKJV', () => {
  // 1.2.2
  it('returns Psalm 23:1 as the first result for "shepherd"', async () => {
    const results = await searchKJV('shepherd', {});
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].reference).toBe('Psalms 23:1');
  });

  // 1.2.3
  it('returns John 3:16 for "For God so loved the world"', async () => {
    const results = await searchKJV('For God so loved the world', {});
    const refs = results.map(r => r.reference);
    expect(refs).toContain('John 3:16');
  });

  // 1.2.4
  it('returns Genesis 1:1 for "beginning god created" (words out of order, fuzzy)', async () => {
    const results = await searchKJV('beginning god created', {});
    const refs = results.map(r => r.reference);
    expect(refs).toContain('Genesis 1:1');
  });

  // 1.2.5
  it('returns [] for empty query', async () => {
    const results = await searchKJV('', {});
    expect(results).toEqual([]);
  });

  // 1.2.6
  it('returns [] for a nonsense query', async () => {
    const results = await searchKJV('zzzznotaword', {});
    expect(results).toEqual([]);
  });

  // 1.2.7
  it('does not return Psalm 23:1 when testament is filtered to "new"', async () => {
    const results = await searchKJV('shepherd', { testament: 'new' });
    const refs = results.map(r => r.reference);
    expect(refs).not.toContain('Psalms 23:1');
  });

  // 1.2.8
  it('returns only Psalms results when book is filtered to "Psalms"', async () => {
    const results = await searchKJV('shepherd', { book: 'Psalms' });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.reference.startsWith('Psalms')).toBe(true);
    }
  });

  // 1.2.9
  it('each result has the correct shape', async () => {
    const results = await searchKJV('shepherd', {});
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(typeof r.reference).toBe('string');
    expect(typeof r.text).toBe('string');
    expect(typeof r.book).toBe('string');
    expect(typeof r.chapter).toBe('number');
    expect(typeof r.verse).toBe('number');
    expect(typeof r.score).toBe('number');
  });

  // 1.2.10
  it('results are in descending score order', async () => {
    const results = await searchKJV('shepherd', {});
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  // 1.2.11
  it('returns at most 50 results by default', async () => {
    const results = await searchKJV('LORD is my shepherd', {});
    expect(results.length).toBeLessThanOrEqual(50);
  });

  // 1.2.12
  it('returns exactly 5 results when limit is 5', async () => {
    const results = await searchKJV('lord', { limit: 5 });
    expect(results.length).toBe(5);
  });
});
