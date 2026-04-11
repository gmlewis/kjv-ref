// ── Word Bank ──────────────────────────────────────────────────────────────────

/** Seeded shuffle — same seed always returns same order */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(((seed * (i + 1) * 2654435761) >>> 0) % (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Split verse text into word tokens and seeded-shuffle them */
export function buildWordBank(text: string, seed: number): string[] {
  const tokens = text.split(' ').filter(t => t.length > 0);
  return seededShuffle(tokens, seed);
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Check whether the selected word tokens match the target verse text */
export function checkWordBankAnswer(selectedTokens: string[], targetText: string): boolean {
  return normalise(selectedTokens.join(' ')) === normalise(targetText);
}

// ── First Letters ──────────────────────────────────────────────────────────────

/**
 * Return a space-separated string of the first letter of each word.
 * Strips leading non-alphabetic characters (e.g. opening quotes) before
 * extracting the letter, preserving original capitalisation.
 */
export function toFirstLetters(text: string): string {
  if (!text) return '';
  return text
    .split(' ')
    .filter(w => w.length > 0)
    .map(word => {
      // Strip leading non-alpha characters
      const stripped = word.replace(/^[^a-zA-Z]+/, '');
      return stripped.length > 0 ? stripped[0] : '';
    })
    .filter(l => l.length > 0)
    .join(' ');
}

// ── Vanishing Cloze ────────────────────────────────────────────────────────────

/**
 * Map timesRecited → cloze difficulty level (0–4).
 *  0 = study card (0% hidden)
 *  1 = 25% hidden
 *  2 = 50% hidden
 *  3 = 75% hidden
 *  4 = full recall (100% hidden)
 */
export function getVanishingClozeLevel(timesRecited: number): 0 | 1 | 2 | 3 | 4 {
  if (timesRecited <= 0) return 0;
  if (timesRecited <= 2) return 1;
  if (timesRecited <= 5) return 2;
  if (timesRecited <= 9) return 3;
  return 4;
}

const BLANK = '______';

/**
 * Replace a fraction of words with blanks based on cloze level.
 * Deterministic: same text+level+seed always gives same result.
 */
export function applyVanishingCloze(text: string, level: 0 | 1 | 2 | 3 | 4, seed: number): string {
  if (level === 0) return text;
  const words = text.split(' ');
  if (level === 4) return words.map(() => BLANK).join(' ');

  const fractions: Record<1 | 2 | 3, number> = { 1: 0.25, 2: 0.5, 3: 0.75 };
  const fraction = fractions[level as 1 | 2 | 3];
  const blankCount = Math.max(1, Math.round(words.length * fraction));

  // Deterministically pick which indices to blank using seeded selection
  const indices = new Set<number>();
  let s = seed;
  while (indices.size < blankCount) {
    s = (s * 1664525 + 1013904223) >>> 0; // LCG
    indices.add(s % words.length);
  }

  return words.map((w, i) => (indices.has(i) ? BLANK : w)).join(' ');
}

/** The missing words (in order of appearance) for a vanishing cloze */
export function getVanishingClozeAnswers(text: string, level: 0 | 1 | 2 | 3 | 4, seed: number): string[] {
  if (level === 0) return [];
  const words = text.split(' ');
  if (level === 4) return [...words];

  const fractions: Record<1 | 2 | 3, number> = { 1: 0.25, 2: 0.5, 3: 0.75 };
  const fraction = fractions[level as 1 | 2 | 3];
  const blankCount = Math.max(1, Math.round(words.length * fraction));

  const indices = new Set<number>();
  let s = seed;
  while (indices.size < blankCount) {
    s = (s * 1664525 + 1013904223) >>> 0;
    indices.add(s % words.length);
  }

  return words.filter((_, i) => indices.has(i));
}
