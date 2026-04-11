import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInterlinearWordBook, _wordCache, _wordLoading } from './interlinear';

beforeEach(() => {
  _wordCache.clear();
  _wordLoading.clear();
  vi.restoreAllMocks();
});

describe('getInterlinearWordBook', () => {
  it('returns parsed word data on success', async () => {
    const fakeData = { 'Ge.2.1': [['בְּרֵאשִׁית', 'H7225', 'be.re.Shit', 'in beginning', 'HR']] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeData,
    }));

    const result = await getInterlinearWordBook('Ge');
    expect(result).toEqual(fakeData);
  });

  it('caches a successful result so fetch is only called once', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await getInterlinearWordBook('Ge');
    await getInterlinearWordBook('Ge');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ─── Regression: failed fetch must NOT permanently poison the cache ───────
  // Before the fix, a 404 wrote `{}` into _wordCache, so the second call
  // (after the correct presigned URL was registered) returned empty data.
  // After the fix, a failed fetch clears _wordLoading so the next call retries.

  it('does not permanently cache a failed fetch, allowing a retry', async () => {
    // First call: fetch fails (simulates 404 before presigned URL is registered)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const first = await getInterlinearWordBook('Psa');
    expect(first).toEqual({});              // returns empty for this call
    expect(_wordCache.has('Psa')).toBe(false); // NOT cached
    expect(_wordLoading.has('Psa')).toBe(false); // loading entry cleared

    // Second call: fetch now succeeds (presigned URL registered)
    const goodData = { 'Psa.3.1': [['יְהוָה', 'H3068', 'yah.Weh', 'Yahweh', 'HNpm']] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => goodData }));
    const second = await getInterlinearWordBook('Psa');
    expect(second).toEqual(goodData);       // retry succeeds
    expect(_wordCache.has('Psa')).toBe(true); // now cached
  });

  it('does not retry after a successful fetch (uses cache)', async () => {
    const goodData = { 'Psa.23.1': [['יְהוָה', 'H3068', 'yah.Weh', 'my shepherd', 'HNpm']] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => goodData }));

    await getInterlinearWordBook('Psa');
    _wordLoading.clear(); // simulate re-entry, cache still has entry

    const failFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', failFetch);

    const result = await getInterlinearWordBook('Psa');
    expect(result).toEqual(goodData); // served from cache, no re-fetch
    expect(failFetch).not.toHaveBeenCalled();
  });
});
