import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { _setBibleForTesting } from '../data/kjv-bible';
import { searchBibleQuery, hasSpecialSyntax } from './bibleQueryEval';

const KJV_RAW = readFileSync(join(__dirname, '../../kjv.txt'), 'utf-8');

beforeAll(() => {
  _setBibleForTesting(KJV_RAW);
});

describe('hasSpecialSyntax', () => {
  it('returns false for plain word', () => {
    expect(hasSpecialSyntax('love')).toBe(false);
  });

  it('returns false for plain multi-word', () => {
    expect(hasSpecialSyntax('love god')).toBe(false);
  });

  it('returns true for quotes', () => {
    expect(hasSpecialSyntax('"love"')).toBe(true);
  });

  it('returns true for pipe', () => {
    expect(hasSpecialSyntax('love|charity')).toBe(true);
  });

  it('returns true for wildcard *', () => {
    expect(hasSpecialSyntax('lov*')).toBe(true);
  });

  it('returns true for wildcard ?', () => {
    expect(hasSpecialSyntax('l?ve')).toBe(true);
  });

  it('returns true for brackets', () => {
    expect(hasSpecialSyntax('l[ai]ve')).toBe(true);
  });

  it('returns true for exclude -', () => {
    expect(hasSpecialSyntax('love -hate')).toBe(true);
  });
});

describe('searchBibleQuery', () => {
  // ─── Single word ──────────────────────────────────────────────────────

  it('finds verses containing "love"', async () => {
    const results = await searchBibleQuery('love', { limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    // Every result should contain "love" (case-insensitive substring)
    for (const r of results) {
      expect(r.text.toLowerCase()).toContain('love');
    }
  });

  it('returns empty for nonsense query', async () => {
    const results = await searchBibleQuery('zzzqqqxxx', {});
    expect(results).toEqual([]);
  });

  it('returns empty for empty query', async () => {
    const results = await searchBibleQuery('', {});
    expect(results).toEqual([]);
  });

  it('returns empty for whitespace query', async () => {
    const results = await searchBibleQuery('   ', {});
    expect(results).toEqual([]);
  });

  // ─── Multiple words (AND) ─────────────────────────────────────────────

  it('AND: finds verses with both "love" and "god"', async () => {
    const results = await searchBibleQuery('love god', { limit: 20 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const lower = r.text.toLowerCase();
      expect(lower).toContain('love');
      expect(lower).toContain('god');
    }
  });

  it('AND: returns fewer results than single word', async () => {
    const loveOnly = await searchBibleQuery('love', { limit: 500 });
    const loveGod = await searchBibleQuery('love god', { limit: 500 });
    expect(loveGod.length).toBeLessThan(loveOnly.length);
  });

  // ─── Quoted phrases ───────────────────────────────────────────────────

  it('phrase: "In the beginning" matches Genesis 1:1', async () => {
    const results = await searchBibleQuery('"In the beginning"', { limit: 50 });
    expect(results.some(r => r.reference === 'Genesis 1:1')).toBe(true);
  });

  it('phrase: words must be consecutive', async () => {
    // "God the" as a phrase should find verses where "God" is immediately followed by "the"
    const results = await searchBibleQuery('"God the"', { limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    // Verify consecutive: the word "god" should be immediately followed by "the"
    // in the verse's word array (not just both present in the text)
    for (const r of results) {
      const words = r.text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      let found = false;
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i] === 'god' && words[i + 1] === 'the') { found = true; break; }
      }
      expect(found).toBe(true);
    }
  });

  it('phrase: "the love of God" finds exact sequence', async () => {
    const results = await searchBibleQuery('"the love of God"', { limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.text.toLowerCase()).toMatch(/the love of god/);
    }
  });

  // ─── OR operator (|) ──────────────────────────────────────────────────

  it('OR: love|charity finds verses with either word', async () => {
    const results = await searchBibleQuery('love|charity', { limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const lower = r.text.toLowerCase();
      expect(lower.includes('love') || lower.includes('charity')).toBe(true);
    }
  });

  it('OR: returns more results than either term alone', async () => {
    const loveOnly = await searchBibleQuery('love', { limit: 500 });
    const charityOnly = await searchBibleQuery('charity', { limit: 500 });
    const orResults = await searchBibleQuery('love|charity', { limit: 500 });
    expect(orResults.length).toBeGreaterThanOrEqual(loveOnly.length);
    expect(orResults.length).toBeGreaterThanOrEqual(charityOnly.length);
  });

  it('OR: "the Lord"|God matches either phrase', async () => {
    const results = await searchBibleQuery('"the Lord"|God', { limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const lower = r.text.toLowerCase();
      expect(lower.match(/the lord\b/) || lower.includes('god')).toBeTruthy();
    }
  });

  // ─── Wildcards ────────────────────────────────────────────────────────

  it('wildcard lov* matches love, loved, loving, etc.', async () => {
    const results = await searchBibleQuery('lov*', { limit: 20 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.text.toLowerCase()).toMatch(/\blov\w*\b/);
    }
  });

  it('wildcard l?ve matches 4-letter l_ve words', async () => {
    const results = await searchBibleQuery('l?ve', { limit: 20 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.text.toLowerCase()).toMatch(/\bl.ve\b/);
    }
  });

  it('wildcard l[ai]ve matches live or lave', async () => {
    const results = await searchBibleQuery('l[ai]ve', { limit: 20 });
    for (const r of results) {
      // The verse should contain a word matching l[ai]ve (live or lave)
      const words = r.text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      expect(words.some(w => /^l[ai]ve$/.test(w))).toBe(true);
    }
  });

  // ─── Any-word placeholder (*) ─────────────────────────────────────────

  it('any-word: "the * of God" matches verses with any word between', async () => {
    const results = await searchBibleQuery('"the * of God"', { limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    // Verify each result has "the [word] of god" pattern in the word array
    for (const r of results) {
      const words = r.text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      let found = false;
      for (let i = 0; i <= words.length - 4; i++) {
        if (words[i] === 'the' && words[i + 2] === 'of' && words[i + 3] === 'god') { found = true; break; }
      }
      expect(found).toBe(true);
    }
  });

  it('any-word: "the * of God" does NOT match "the of God" (zero words)', async () => {
    // The * requires at least one word
    const results = await searchBibleQuery('"the * of God"', { limit: 500 });
    for (const r of results) {
      // Should not match "the of god" (zero words between)
      expect(r.text.toLowerCase()).not.toMatch(/the of god/);
    }
  });

  // ─── Exclude (-) ──────────────────────────────────────────────────────

  it('exclude: love -hate removes verses containing "hate"', async () => {
    const results = await searchBibleQuery('love -hate', { limit: 100 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.text.toLowerCase()).toContain('love');
      expect(r.text.toLowerCase()).not.toContain('hate');
    }
  });

  it('exclude: -"the devil" removes verses with that phrase', async () => {
    const results = await searchBibleQuery('love -"the devil"', { limit: 100 });
    for (const r of results) {
      expect(r.text.toLowerCase()).toContain('love');
      expect(r.text.toLowerCase()).not.toMatch(/the devil/);
    }
  });

  // ─── Testament filter ─────────────────────────────────────────────────

  it('testament filter: old only', async () => {
    const results = await searchBibleQuery('love', { testament: 'old', limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      // All should be OT books
      const otBooks = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
        'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
        '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job',
        'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
        'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
        'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
        'Haggai', 'Zechariah', 'Malachi'];
      expect(otBooks).toContain(r.book);
    }
  });

  it('testament filter: new only', async () => {
    const results = await searchBibleQuery('love', { testament: 'new', limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const ntBooks = ['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
        '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
        'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
        '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
        '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];
      expect(ntBooks).toContain(r.book);
    }
  });

  // ─── Book filter ──────────────────────────────────────────────────────

  it('book filter: only Psalms', async () => {
    const results = await searchBibleQuery('shepherd', { book: 'Psalms', limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.book).toBe('Psalms');
    }
  });

  // ─── Limit ────────────────────────────────────────────────────────────

  it('respects limit option', async () => {
    const results = await searchBibleQuery('the', { limit: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  // ─── Combined expressions ─────────────────────────────────────────────

  it('phrase + exclude: "the Lord" -"the Lord God"', async () => {
    const results = await searchBibleQuery('"the Lord" -"the Lord God"', { limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.text.toLowerCase()).toMatch(/the lord/);
      expect(r.text.toLowerCase()).not.toMatch(/the lord god/);
    }
  });

  it('OR + AND: love|charity god', async () => {
    const results = await searchBibleQuery('love|charity god', { limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const lower = r.text.toLowerCase();
      // Must have (love OR charity) AND god
      expect(lower.includes('love') || lower.includes('charity')).toBe(true);
      expect(lower).toContain('god');
    }
  });

  it('wildcard + phrase: lov* "of God"', async () => {
    const results = await searchBibleQuery('lov* "of God"', { limit: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const lower = r.text.toLowerCase();
      expect(lower).toMatch(/lov\w*/);
      expect(lower).toMatch(/of god/);
    }
  });

  // ─── Result shape ─────────────────────────────────────────────────────

  it('results have correct shape', async () => {
    const results = await searchBibleQuery('love', { limit: 3 });
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r).toHaveProperty('reference');
    expect(r).toHaveProperty('text');
    expect(r).toHaveProperty('book');
    expect(r).toHaveProperty('chapter');
    expect(r).toHaveProperty('verse');
    expect(r).toHaveProperty('score');
    expect(typeof r.reference).toBe('string');
    expect(typeof r.text).toBe('string');
    expect(typeof r.book).toBe('string');
    expect(typeof r.chapter).toBe('number');
    expect(typeof r.verse).toBe('number');
    expect(typeof r.score).toBe('number');
  });

  it('results are sorted by score descending', async () => {
    const results = await searchBibleQuery('love', { limit: 20 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  // ─── Known verse tests ────────────────────────────────────────────────

  it('finds John 3:16 with "God so loved"', async () => {
    const results = await searchBibleQuery('"God so loved"', { limit: 10 });
    expect(results.some(r => r.reference === 'John 3:16')).toBe(true);
  });

  it('finds Psalm 23:1 with "shepherd"', async () => {
    const results = await searchBibleQuery('shepherd', { limit: 50 });
    expect(results.some(r => r.reference === 'Psalms 23:1')).toBe(true);
  });

  it('finds Genesis 1:1 with "In the beginning"', async () => {
    const results = await searchBibleQuery('"In the beginning"', { limit: 10 });
    expect(results.some(r => r.reference === 'Genesis 1:1')).toBe(true);
  });
});