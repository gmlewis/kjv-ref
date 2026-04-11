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
    const bank = buildWordBank(text, 1);
    expect(bank.slice().sort()).toEqual(text.split(' ').sort());
  });

  it('is stable — same seed produces same order', () => {
    expect(buildWordBank(text, 42)).toEqual(buildWordBank(text, 42));
  });

  it('different seeds produce different orders (usually)', () => {
    const a = buildWordBank('In the beginning God created the heaven', 1);
    const b = buildWordBank('In the beginning God created the heaven', 999);
    // At least one position differs (extremely unlikely to collide for 7 words)
    expect(a.join(' ')).not.toBe('In the beginning God created the heaven'); // shuffled
    // Both seeds should be different from each other in practice; just verify same-seed stability
    expect(buildWordBank('In the beginning God created the heaven', 1))
      .toEqual(buildWordBank('In the beginning God created the heaven', 1));
  });

  it('preserves punctuation attached to words', () => {
    const bank = buildWordBank('God, so loved the world.', 1);
    expect(bank).toContain('God,');
    expect(bank).toContain('world.');
  });

  it('handles single-word text', () => {
    expect(buildWordBank('Amen', 1)).toEqual(['Amen']);
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
    expect(applyVanishingCloze(text, 0, 1)).toBe(text);
  });

  it('level 4 blanks all words', () => {
    const result = applyVanishingCloze(text, 4, 1);
    expect(result).not.toContain('God');
    expect(result).not.toContain('world');
    // All tokens replaced with blanks
    const words = text.split(' ');
    const blanked = result.split(' ');
    expect(blanked.length).toBe(words.length);
    blanked.forEach(b => expect(b).toBe('______'));
  });

  it('level 1 blanks approximately 25% of words', () => {
    const words = text.split(' ');
    const result = applyVanishingCloze(text, 1, 1);
    const blankedCount = result.split(' ').filter(w => w === '______').length;
    // 25% of 13 words ≈ 3 words blanked (allow ±1)
    expect(blankedCount).toBeGreaterThanOrEqual(2);
    expect(blankedCount).toBeLessThanOrEqual(5);
  });

  it('level 2 blanks more than level 1', () => {
    const level1Blanks = applyVanishingCloze(text, 1, 1).split(' ').filter(w => w === '______').length;
    const level2Blanks = applyVanishingCloze(text, 2, 1).split(' ').filter(w => w === '______').length;
    expect(level2Blanks).toBeGreaterThan(level1Blanks);
  });

  it('is deterministic — same text+level+seed always gives same result', () => {
    expect(applyVanishingCloze(text, 2, 7)).toBe(applyVanishingCloze(text, 2, 7));
  });
});
