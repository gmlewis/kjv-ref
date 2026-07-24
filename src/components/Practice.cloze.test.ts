import { describe, it, expect } from 'vitest';
import {
  diffWords,
  diffScore,
  getVanishingClozeLevel,
  applyVanishingCloze,
  getVanishingClozeAnswers,
  getVanishingClozeMask,
  firstLetterOf,
  type DiffToken,
} from '../utils/practiceHelpers';

describe('diffWords — word-by-word comparison', () => {
  const target = 'In the beginning God created the heaven and the earth.';

  it('returns all "correct" when input matches exactly', () => {
    const diff = diffWords(target, target);
    expect(diff.every(d => d.type === 'correct')).toBe(true);
    expect(diff).toHaveLength(target.split(' ').length);
  });

  it('marks a wrong word with the expected replacement', () => {
    const user = 'In the beginning Gods created the heaven and the earth.';
    const diff = diffWords(user, target);
    const wrong = diff.find(d => d.type === 'wrong') as Extract<DiffToken, { type: 'wrong' }> | undefined;
    expect(wrong).toBeDefined();
    expect(wrong!.word).toBe('Gods');
    expect(wrong!.expected).toBe('God');
  });

  it('marks missing words when the user typed fewer words than the target', () => {
    const user = 'In the beginning created the heaven and the earth.';
    const diff = diffWords(user, target);
    const missing = diff.filter(d => d.type === 'missing');
    expect(missing.length).toBeGreaterThanOrEqual(1);
    // "God" should be among the missing words (it was skipped)
    const missingExpected = (missing[0] as Extract<DiffToken, { type: 'missing' }>).expected;
    expect(['God', 'the', 'earth.']).toContain(missingExpected);
  });

  it('marks extra words when the user typed more than the target', () => {
    const user = 'In the very beginning God created the heaven and the earth.';
    const diff = diffWords(user, target);
    const extras = diff.filter(d => d.type === 'extra');
    expect(extras.length).toBeGreaterThanOrEqual(1);
  });

  it('is case-insensitive', () => {
    const user = 'in the beginning god created the heaven and the earth.';
    const diff = diffWords(user, target);
    // All target words should match (correct), since comparison ignores case
    const wrongOrMissing = diff.filter(d => d.type === 'wrong' || d.type === 'missing');
    // Case differences alone should not produce wrong/missing tokens
    expect(wrongOrMissing.length).toBe(0);
  });

  it('ignores punctuation for matching', () => {
    const userNoPunct = 'In the beginning God created the heaven and the earth';
    const diff = diffWords(userNoPunct, target);
    // The trailing period should not cause a mismatch since punctuation is
    // stripped for comparison
    const wrong = diff.filter(d => d.type === 'wrong');
    expect(wrong.length).toBe(0);
  });

  it('handles empty user input (all missing)', () => {
    const diff = diffWords('', target);
    expect(diff.every(d => d.type === 'missing')).toBe(true);
    expect(diff).toHaveLength(target.split(' ').length);
  });

  it('preserves the original surface form of user words for display', () => {
    const user = 'IN THE BEGINNING';
    const diff = diffWords(user, target);
    const first = diff[0] as Extract<DiffToken, { type: 'correct' | 'wrong' }>;
    expect(first.word).toBe('IN');
  });
});

describe('diffScore — correct/total counts', () => {
  it('counts a perfect match as 100%', () => {
    const target = 'God so loved the world';
    const diff = diffWords(target, target);
    const { correct, total } = diffScore(diff);
    expect(correct).toBe(total);
    expect(total).toBe(5);
  });

  it('counts one wrong word out of five as 4/5', () => {
    const target = 'God so loved the world';
    const diff = diffWords('God so hated the world', target);
    const { correct, total } = diffScore(diff);
    expect(correct).toBe(4);
    expect(total).toBe(5);
  });

  it('excludes extra words from the total', () => {
    const target = 'God so loved';
    const diff = diffWords('God so very loved', target);
    const { correct, total } = diffScore(diff);
    expect(total).toBe(3);
    expect(correct).toBe(3);
  });
});

describe('Vanishing Cloze level override', () => {
  // The override logic lives in Practice.tsx, but the building blocks are
  // testable here: getVanishingClozeLevel produces the auto level, and the
  // component picks `customClozeLevel ?? autoLevel`. We verify the helpers
  // behave so the override semantics are well-defined.

  it('auto level jumps from 0 → 4 when timesRecited crosses thresholds', () => {
    expect(getVanishingClozeLevel(0)).toBe(0);
    expect(getVanishingClozeLevel(1)).toBe(1);
    expect(getVanishingClozeLevel(2)).toBe(1);
    expect(getVanishingClozeLevel(3)).toBe(2);
    expect(getVanishingClozeLevel(5)).toBe(2);
    expect(getVanishingClozeLevel(6)).toBe(3);
    expect(getVanishingClozeLevel(9)).toBe(3);
    expect(getVanishingClozeLevel(10)).toBe(4);
    expect(getVanishingClozeLevel(100)).toBe(4);
  });

  it('an override to level 4 fully blanks all words regardless of timesRecited', () => {
    const text = 'The LORD is my shepherd; I shall not want.';
    const blanked = applyVanishingCloze(text, 4, 7);
    expect(blanked.split(' ').every(w => w.includes('___'))).toBe(true);
    expect(getVanishingClozeAnswers(text, 4, 7)).toHaveLength(text.split(' ').length);
  });

  it('an override to level 0 shows the full verse even when timesRecited is high', () => {
    const text = 'The LORD is my shepherd; I shall not want.';
    const blanked = applyVanishingCloze(text, 0, 7);
    expect(blanked).toBe(text);
    expect(getVanishingClozeAnswers(text, 0, 7)).toEqual([]);
  });

  it('override precedence: customClozeLevel ?? autoLevel resolves correctly', () => {
    const autoLevel = getVanishingClozeLevel(100); // 4
    const custom: 0 | 1 | 2 | 3 | 4 | null = 1;
    const effective = custom ?? autoLevel;
    expect(effective).toBe(1);
    // When null/undefined, fall back to auto
    const n: 0 | 1 | 2 | 3 | 4 | null = null;
    const u: 0 | 1 | 2 | 3 | 4 | null | undefined = undefined;
    expect(n ?? autoLevel).toBe(autoLevel);
    expect(u ?? autoLevel).toBe(autoLevel);
  });
});

describe('getVanishingClozeMask', () => {
  const text = 'For God so loved the world that he gave his only begotten Son';

  it('level 0 returns all-false mask', () => {
    const mask = getVanishingClozeMask(text, 0, 1);
    expect(mask.every(b => b === false)).toBe(true);
    expect(mask).toHaveLength(text.split(' ').length);
  });

  it('level 4 returns all-true mask', () => {
    const mask = getVanishingClozeMask(text, 4, 1);
    expect(mask.every(b => b === true)).toBe(true);
  });

  it('mask count matches applyVanishingCloze blank count', () => {
    for (const lvl of [1, 2, 3] as const) {
      const mask = getVanishingClozeMask(text, lvl, 7);
      const blanked = applyVanishingCloze(text, lvl, 7).split(' ');
      const maskCount = mask.filter(Boolean).length;
      const blankCount = blanked.filter(w => w === '______').length;
      expect(maskCount).toBe(blankCount);
    }
  });

  it('mask indices match getVanishingClozeAnswers selection', () => {
    const mask = getVanishingClozeMask(text, 2, 7);
    const words = text.split(' ');
    const expectedBlanks = new Set(getVanishingClozeAnswers(text, 2, 7));
    const maskBlanks = new Set(words.filter((_, i) => mask[i]));
    expect(maskBlanks).toEqual(expectedBlanks);
  });

  it('is deterministic — same text+level+seed gives same mask', () => {
    expect(getVanishingClozeMask(text, 2, 7)).toEqual(getVanishingClozeMask(text, 2, 7));
  });
});

describe('firstLetterOf', () => {
  it('returns the first alphabetic character of a word', () => {
    expect(firstLetterOf('For')).toBe('F');
    expect(firstLetterOf('God')).toBe('G');
    expect(firstLetterOf('loved')).toBe('l');
  });

  it('strips leading non-alphabetic characters', () => {
    expect(firstLetterOf('"And')).toBe('A');
    expect(firstLetterOf('...God')).toBe('G');
    expect(firstLetterOf("''Lord's")).toBe('L');
  });

  it('returns empty string for words with no alphabetic character', () => {
    expect(firstLetterOf('---')).toBe('');
    expect(firstLetterOf('123')).toBe('');
    expect(firstLetterOf('')).toBe('');
  });

  it('preserves original case of the first letter', () => {
    expect(firstLetterOf('The')).toBe('T');
    expect(firstLetterOf('the')).toBe('t');
  });
});