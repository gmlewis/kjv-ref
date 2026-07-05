import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verseAnchorId } from './urlHelpers';

/**
 * Regression tests for verse hash scroll target parsing.
 * Ensures that #v23 resolves to verse 23, not verse 9 or any other number.
 */

describe('verseAnchorId', () => {
  it('produces correct id for single-digit verse', () => {
    expect(verseAnchorId(3)).toBe('v3');
  });

  it('produces correct id for double-digit verse', () => {
    expect(verseAnchorId(23)).toBe('v23');
  });

  it('produces correct id for triple-digit verse (Psalm 119)', () => {
    expect(verseAnchorId(176)).toBe('v176');
  });
});

describe('hash-to-scrollTarget parsing', () => {
  // Replicate the exact parsing logic from Books.tsx ChapterView
  function parseScrollTarget(hash: string): number | null {
    if (!hash.startsWith('#v')) return null;
    const n = parseInt(hash.slice(2), 10);
    return isNaN(n) ? null : n;
  }

  it('parses #v3 correctly', () => {
    expect(parseScrollTarget('#v3')).toBe(3);
  });

  it('parses #v23 correctly (not #v9)', () => {
    expect(parseScrollTarget('#v23')).toBe(23);
  });

  it('parses #v176 correctly (Psalm 119:176)', () => {
    expect(parseScrollTarget('#v176')).toBe(176);
  });

  it('returns null for empty hash', () => {
    expect(parseScrollTarget('')).toBeNull();
  });

  it('returns null for hash without v prefix', () => {
    expect(parseScrollTarget('#foo')).toBeNull();
  });

  it('returns null for #v with no number', () => {
    expect(parseScrollTarget('#v')).toBeNull();
  });

  it('ignores trailing non-numeric characters', () => {
    expect(parseScrollTarget('#v23foo')).toBe(23);
  });
});

describe('element lookup for scroll target', () => {
  beforeEach(() => {
    // Set up a minimal DOM with verse elements
    document.body.innerHTML = `
      <div id="v1" style="height:200px">Verse 1</div>
      <div id="v5" style="height:200px">Verse 5</div>
      <div id="v9" style="height:200px">Verse 9</div>
      <div id="v23" style="height:200px">Verse 23</div>
      <div id="v31" style="height:200px">Verse 31</div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('getElementById finds v23, not v9', () => {
    const el = document.getElementById(verseAnchorId(23));
    expect(el).not.toBeNull();
    expect(el!.id).toBe('v23');
    expect(el!.textContent).toBe('Verse 23');
  });

  it('getElementById finds v9', () => {
    const el = document.getElementById(verseAnchorId(9));
    expect(el).not.toBeNull();
    expect(el!.id).toBe('v9');
    expect(el!.textContent).toBe('Verse 9');
  });

  it('scrollTarget=23 maps to element v23, not v9', () => {
    const scrollTarget = 23;
    const el = document.getElementById(verseAnchorId(scrollTarget));
    expect(el!.id).toBe('v23');
    // Verify it is NOT verse 9
    expect(el!.id).not.toBe('v9');
  });

  it('each verse has a unique id', () => {
    const ids = [1, 5, 9, 23, 31].map(v => verseAnchorId(v));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
