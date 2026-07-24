import { describe, it, expect } from 'vitest';
import {
  getVanishingClozeLevel,
  getVanishingClozeMask,
  getVanishingClozeAnswers,
  firstLetterOf,
  applyVanishingCloze,
} from '../utils/practiceHelpers';

// The Simplified Vanishing Cloze mode (see Practice.tsx) uses these helpers
// to drive its per-blank first-letter input flow. These tests exercise the
// same logic the component uses to:
//   1. compute the blank mask
//   2. validate the single typed letter against the expected first letter
//   3. decide whether the verse is "all correct"
//   4. handle the '?' reveal (recorded as incorrect)

describe('Simplified Vanishing Cloze — first-letter validation logic', () => {
  const verse = 'The LORD is my shepherd; I shall not want.';
  // Use a level/mask that blanks a known set of words.
  const mask = getVanishingClozeMask(verse, 4, 7); // level 4 = all blanked
  const words = verse.split(' ');
  const blankIndices = mask.map((b, i) => (b ? i : -1)).filter(i => i >= 0);

  it('level 4 blanks every word, so every word needs a first letter', () => {
    expect(blankIndices).toEqual(words.map((_, i) => i));
  });

  it('a correct first letter (case-insensitive) matches the expected letter', () => {
    const expected = firstLetterOf(words[0]).toLowerCase(); // 't'
    expect('t').toBe(expected);
    expect('T'.toLowerCase()).toBe(expected);
  });

  it('a wrong first letter does not match the expected letter', () => {
    const expected = firstLetterOf(words[0]).toLowerCase(); // 't'
    expect('x').not.toBe(expected);
  });

  it('all-correct requires every blank to have a matching first letter', () => {
    const entries: Record<number, string> = {};
    for (const idx of blankIndices) entries[idx] = firstLetterOf(words[idx]);
    const allCorrect = blankIndices.every(
      idx => entries[idx].toLowerCase() === firstLetterOf(words[idx]).toLowerCase(),
    );
    expect(allCorrect).toBe(true);
  });

  it('a single wrong letter makes the verse not all-correct', () => {
    const entries: Record<number, string> = {};
    for (const idx of blankIndices) entries[idx] = firstLetterOf(words[idx]);
    entries[blankIndices[0]] = 'z';
    const allCorrect = blankIndices.every(
      idx => entries[idx].toLowerCase() === firstLetterOf(words[idx]).toLowerCase(),
    );
    expect(allCorrect).toBe(false);
  });

  it('a "?" reveal is recorded as incorrect (not all-correct)', () => {
    const entries: Record<number, string> = {};
    for (const idx of blankIndices) entries[idx] = firstLetterOf(words[idx]);
    entries[blankIndices[0]] = '?';
    const allCorrect = blankIndices.every(idx => {
      if (entries[idx] === '?') return false;
      return entries[idx].toLowerCase() === firstLetterOf(words[idx]).toLowerCase();
    });
    expect(allCorrect).toBe(false);
  });

  it('an empty entry is treated as wrong (not all-correct)', () => {
    const entries: Record<number, string> = {};
    for (const idx of blankIndices) entries[idx] = firstLetterOf(words[idx]);
    entries[blankIndices[0]] = '';
    const allFilled = blankIndices.every(idx => (entries[idx] ?? '').length > 0);
    expect(allFilled).toBe(false);
  });
});

describe('Simplified Vanishing Cloze — level progression mirrors Vanishing Cloze', () => {
  it('uses the same auto level thresholds as Vanishing Cloze', () => {
    expect(getVanishingClozeLevel(0)).toBe(0);
    expect(getVanishingClozeLevel(1)).toBe(1);
    expect(getVanishingClozeLevel(10)).toBe(4);
  });

  it('level 0 produces an empty blank mask (study card)', () => {
    const mask = getVanishingClozeMask('In the beginning God created', 0, 1);
    expect(mask.every(b => !b)).toBe(true);
  });

  it('mask is consistent with applyVanishingCloze output', () => {
    const text = 'For God so loved the world that whosoever believeth in him';
    for (const lvl of [1, 2, 3] as const) {
      const mask = getVanishingClozeMask(text, lvl, 42);
      const blanked = applyVanishingCloze(text, lvl, 42).split(' ');
      mask.forEach((b, i) => {
        if (b) expect(blanked[i]).toBe('______');
        else expect(blanked[i]).not.toBe('______');
      });
    }
  });

  it('masked words are exactly the answers returned by getVanishingClozeAnswers', () => {
    const text = 'For God so loved the world that whosoever believeth in him';
    const mask = getVanishingClozeMask(text, 2, 42);
    const words = text.split(' ');
    const maskedWords = words.filter((_, i) => mask[i]);
    const answers = getVanishingClozeAnswers(text, 2, 42);
    expect(maskedWords).toEqual(answers);
  });
});

describe('Simplified Vanishing Cloze — first-letter edge cases', () => {
  it('words with leading punctuation still extract the right first letter', () => {
    expect(firstLetterOf('"Lord')).toBe('L');
    expect(firstLetterOf("'saviour")).toBe('s');
  });

  it('a blanked word whose first letter is non-alphabetic yields "" and any typed letter is wrong', () => {
    // Construct a verse-like string where a "word" is purely punctuation.
    const word = '---';
    expect(firstLetterOf(word)).toBe('');
    // Component treats got === expected; "" got vs "t" expected => wrong.
    expect('t'.toLowerCase() === firstLetterOf(word).toLowerCase()).toBe(false);
  });
});