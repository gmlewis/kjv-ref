import { describe, it, expect } from 'vitest';
import {
  buildWordBank,
  checkWordBankAnswer,
  toFirstLetters,
  getVanishingClozeLevel,
  applyVanishingCloze,
} from './practiceHelpers';

// ── Word Bank ──────────────────────────────────────────────────────────────────

describe('buildWordBank', () => {
  const text = 'For God so loved the world';

  it('returns same tokens as the verse words', () => {
    const bank = buildWordBank(text);
    expect(bank.slice().sort()).toEqual(text.split(' ').sort());
  });

  it('shuffles the order (non-deterministic via Math.random)', () => {
    // The bank should be a permutation of the original words, but almost
    // never in the original order (extremely unlikely for 6 words).
    const bank = buildWordBank('In the beginning God created the heaven');
    expect(bank.slice().sort()).toEqual(['In', 'the', 'beginning', 'God', 'created', 'the', 'heaven'].sort());
    expect(bank.join(' ')).not.toBe('In the beginning God created the heaven');
  });

  it('preserves punctuation attached to words', () => {
    const bank = buildWordBank('God, so loved the world.');
    expect(bank).toContain('God,');
    expect(bank).toContain('world.');
  });

  it('handles single-word text', () => {
    expect(buildWordBank('Amen')).toEqual(['Amen']);
  });
});

describe('checkWordBankAnswer', () => {
  it('returns true for exact match', () => {
    expect(checkWordBankAnswer(['For', 'God', 'so'], 'For God so')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(checkWordBankAnswer(['for', 'god', 'so'], 'For God so')).toBe(true);
  });

  it('strips punctuation for comparison', () => {
    expect(checkWordBankAnswer(['God,', 'loved', 'the', 'world.'], 'God, loved the world.')).toBe(true);
  });

  it('returns false for wrong order', () => {
    expect(checkWordBankAnswer(['world', 'the', 'loved'], 'loved the world')).toBe(false);
  });

  it('returns false for missing word', () => {
    expect(checkWordBankAnswer(['For', 'God'], 'For God so')).toBe(false);
  });
});

// ── First Letters ──────────────────────────────────────────────────────────────

describe('toFirstLetters', () => {
  it('returns first letter of each word', () => {
    expect(toFirstLetters('For God so loved the world')).toBe('F G s l t w');
  });

  it('preserves original capitalisation', () => {
    expect(toFirstLetters('In the beginning God')).toBe('I t b G');
  });

  it('handles empty string', () => {
    expect(toFirstLetters('')).toBe('');
  });

  it('strips leading punctuation from a word before taking first letter', () => {
    // e.g. word starting with quote
    expect(toFirstLetters('"And God said')).toBe('A G s');
  });

  it('handles single-word input', () => {
    expect(toFirstLetters('Amen')).toBe('A');
  });

  it('works on a longer verse', () => {
    const verse = 'Trust in the LORD with all thine heart';
    const result = toFirstLetters(verse);
    expect(result.split(' ').length).toBe(verse.split(' ').length);
    expect(result[0]).toBe('T');
  });
});

// ── Vanishing Cloze ────────────────────────────────────────────────────────────

describe('getVanishingClozeLevel', () => {
  it('level 0 for 0 recitations (study mode)', () => {
    expect(getVanishingClozeLevel(0)).toBe(0);
  });

  it('level 1 for 1–2 recitations (25% hidden)', () => {
    expect(getVanishingClozeLevel(1)).toBe(1);
    expect(getVanishingClozeLevel(2)).toBe(1);
  });

  it('level 2 for 3–5 recitations (50% hidden)', () => {
    expect(getVanishingClozeLevel(3)).toBe(2);
    expect(getVanishingClozeLevel(5)).toBe(2);
  });

  it('level 3 for 6–9 recitations (75% hidden)', () => {
    expect(getVanishingClozeLevel(6)).toBe(3);
    expect(getVanishingClozeLevel(9)).toBe(3);
  });

  it('level 4 for 10+ recitations (full recall)', () => {
    expect(getVanishingClozeLevel(10)).toBe(4);
    expect(getVanishingClozeLevel(50)).toBe(4);
  });
});

describe('applyVanishingCloze', () => {
  const text = 'For God so loved the world that he gave his only begotten Son';

  it('level 0 returns full text unchanged', () => {
    expect(applyVanishingCloze(text, 0)).toBe(text);
  });

  it('level 4 blanks all words', () => {
    const result = applyVanishingCloze(text, 4);
    expect(result).not.toContain('God');
    expect(result).not.toContain('world');
    // All tokens replaced with blanks
    const words = text.split(' ');
    const blanked = result.split(' ');
    expect(blanked.length).toBe(words.length);
    blanked.forEach(b => expect(b).toBe('______'));
  });

  it('level 1 blanks approximately 25% of words', () => {
    const result = applyVanishingCloze(text, 1);
    const blankedCount = result.split(' ').filter(w => w === '______').length;
    // 25% of 13 words ≈ 3 words blanked (allow ±1)
    expect(blankedCount).toBeGreaterThanOrEqual(2);
    expect(blankedCount).toBeLessThanOrEqual(5);
  });

  it('level 2 blanks more than level 1', () => {
    const level1Blanks = applyVanishingCloze(text, 1).split(' ').filter(w => w === '______').length;
    const level2Blanks = applyVanishingCloze(text, 2).split(' ').filter(w => w === '______').length;
    expect(level2Blanks).toBeGreaterThan(level1Blanks);
  });

  it('is non-deterministic — different calls usually produce different blank selections', () => {
    // With Math.random(), two calls should almost never produce the same
    // blank set for 13 words at level 2 (6 blanks out of 13).
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(applyVanishingCloze(text, 2));
    }
    // We should see at least 2 different selections in 20 draws.
    expect(results.size).toBeGreaterThan(1);
  });
});
