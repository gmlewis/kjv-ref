/**
 * Integration tests for the built public/strongs/word-index.json.
 *
 * These tests load the actual generated file and assert structural properties
 * that would break if build-strongs-index.ts regressed to the old dense format
 * (where only non-empty Strong's numbers were stored, causing position drift).
 *
 * Key invariant: every entry in word-index.json must be a POSITIONAL array —
 * one slot per whitespace-delimited word token — where words without a Strong's
 * number are represented by an empty string ''.
 */

import { describe, it, expect } from 'vitest';
import wordIndex from '../../public/strongs/word-index.json';
import { tokeniseVerse } from './strongs';

const wi = wordIndex as Record<string, string[]>;

// ─── Matthew 7:14 — the verse that exposed the original drift bug ─────────────
// "Because strait is the gate, and narrow is the way, which leadeth unto
//  life, and few there be that find it."
const MAT_7_14_TEXT =
  'Because strait is the gate, and narrow is the way, which leadeth unto life, and few there be that find it.';

describe('word-index positional format — Mat.7.14', () => {
  const entry = wi['Mat.7.14'];

  it('entry exists', () => {
    expect(Array.isArray(entry)).toBe(true);
  });

  it('length equals number of whitespace-delimited tokens in the verse', () => {
    const tokens = tokeniseVerse(MAT_7_14_TEXT);
    expect(entry.length).toBe(tokens.length); // 21
  });

  it('contains empty strings (confirms positional format, not dense)', () => {
    expect(entry.some(s => s === '')).toBe(true);
  });

  it('"life," (token 13) → G2222 (ζωή)', () => {
    // This was the reported bug: "life" was getting G2147 instead of G2222
    expect(entry[13]).toBe('G2222');
  });

  it('"way," (token 9) → G3598 (ὁδός), not G2222', () => {
    // With the old dense format, "way" was incorrectly receiving G2222 (life)
    expect(entry[9]).toBe('G3598');
    expect(entry[9]).not.toBe('G2222');
  });

  it('"find" (token 19) → G2147 (εὑρίσκω)', () => {
    expect(entry[19]).toBe('G2147');
  });

  it('"strait" (token 1) → G4728 (στενός)', () => {
    expect(entry[1]).toBe('G4728');
  });

  it('"is" (token 2) → empty string (no Strong\'s)', () => {
    expect(entry[2]).toBe('');
  });
});

// ─── John 3:16 — spot-check NT alignment ─────────────────────────────────────
const JOHN_3_16_TEXT =
  'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';

describe('word-index positional format — John.3.16', () => {
  const entry = wi['John.3.16'];

  it('entry exists', () => {
    expect(Array.isArray(entry)).toBe(true);
  });

  it('length equals token count', () => {
    expect(entry.length).toBe(tokeniseVerse(JOHN_3_16_TEXT).length); // 25
  });

  it('"God" (token 1) → G2316 (θεός)', () => {
    expect(entry[1]).toBe('G2316');
  });

  it('"loved" (token 3) → G25 (ἀγαπάω)', () => {
    expect(entry[3]).toBe('G25');
  });

  it('"the" (token 4) → empty string', () => {
    expect(entry[4]).toBe('');
  });
});

// ─── Genesis 1:1 — spot-check OT alignment ───────────────────────────────────
const GE_1_1_TEXT = 'In the beginning God created the heaven and the earth.';

describe('word-index positional format — Ge.1.1', () => {
  const entry = wi['Ge.1.1'];

  it('entry exists', () => {
    expect(Array.isArray(entry)).toBe(true);
  });

  it('length equals token count', () => {
    expect(entry.length).toBe(tokeniseVerse(GE_1_1_TEXT).length); // 10
  });

  it('"beginning" (token 2) → H7225 (בְּרֵאשִׁית)', () => {
    expect(entry[2]).toBe('H7225');
  });

  it('"God" (token 3) → H430 (אֱלֹהִים)', () => {
    expect(entry[3]).toBe('H430');
  });

  it('"created" (token 4) → H1254 (בָּרָא)', () => {
    expect(entry[4]).toBe('H1254');
  });
});
