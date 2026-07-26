import { describe, it, expect } from 'vitest';
import { matchRecitation } from './voice';

describe('matchRecitation', () => {
  const verse = 'For God so loved the world that he gave his only begotten Son';
  it('exact recitation → match:true, overlap:1', () => {
    const r = matchRecitation(verse, verse);
    expect(r.match).toBe(true); expect(r.overlap).toBeCloseTo(1, 5);
  });
  it('one missing word of a 10+-word verse still matches (>=0.85)', () => {
    // verse has 12 words; drop one → 11/12 ≈ 0.917
    const r = matchRecitation(verse.replace(' only', ''), verse);
    expect(r.overlap).toBeGreaterThanOrEqual(0.85);
    expect(r.match).toBe(true);
  });
  it('two missing words → below threshold → no match', () => {
    const r = matchRecitation(verse.replace(' only', '').replace(' begotten', ''), verse);
    expect(r.overlap).toBeLessThan(0.85);
    expect(r.match).toBe(false);
  });
  it('is case-insensitive', () => {
    const r = matchRecitation(verse.toUpperCase(), verse);
    expect(r.match).toBe(true); expect(r.overlap).toBe(1);
  });
  it('is punctuation-insensitive', () => {
    const r = matchRecitation('For God so loved the world, that he gave his only begotten Son!', verse);
    expect(r.match).toBe(true);
  });
  it('is order-insensitive (transpositions tolerated)', () => {
    const words = verse.split(' ');
    const reordered = [words[0], words[2], words[1], ...words.slice(3)].join(' ');
    const r = matchRecitation(reordered, verse);
    expect(r.overlap).toBe(1); // same multiset
    expect(r.match).toBe(true);
  });
  it('respects a custom threshold', () => {
    const r = matchRecitation(verse.replace(' only', ''), verse, 0.99);
    expect(r.match).toBe(false);
  });
  it('empty target → no match, overlap 0', () => {
    const r = matchRecitation('anything', '');
    expect(r.match).toBe(false); expect(r.overlap).toBe(0);
  });
  it('duplicate words are counted as a multiset', () => {
    // target has a repeated word; transcript missing one copy
    const target = 'the the the Lord';
    const r = matchRecitation('the the Lord', target);
    expect(r.overlap).toBeCloseTo(3/4, 5); // 3 of 4 target words present
  });
});