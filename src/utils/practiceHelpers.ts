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

/**
 * Return a boolean array marking which word indices are blanked for the
 * given vanishing cloze level + seed. Same selection logic as
 * applyVanishingCloze / getVanishingClozeAnswers so all three stay in sync.
 */
export function getVanishingClozeMask(text: string, level: 0 | 1 | 2 | 3 | 4, seed: number): boolean[] {
  const words = text.split(' ');
  if (level === 0) return words.map(() => false);
  if (level === 4) return words.map(() => true);

  const fractions: Record<1 | 2 | 3, number> = { 1: 0.25, 2: 0.5, 3: 0.75 };
  const fraction = fractions[level as 1 | 2 | 3];
  const blankCount = Math.max(1, Math.round(words.length * fraction));

  const indices = new Set<number>();
  let s = seed;
  while (indices.size < blankCount) {
    s = (s * 1664525 + 1013904223) >>> 0;
    indices.add(s % words.length);
  }

  return words.map((_, i) => indices.has(i));
}

/**
 * The "first letter" of a word, stripping leading non-alphabetic characters
 * (e.g. opening quotes) before extracting. Returns '' if the word has no
 * alphabetic character. Used by the Simplified Vanishing Cloze mode to
 * validate the single-letter typed into each blank.
 */
export function firstLetterOf(word: string): string {
  const stripped = word.replace(/^[^a-zA-Z]+/, '');
  return stripped.length > 0 ? stripped[0] : '';
}

// ── Word-by-word diff (for Vanishing Cloze / Recall feedback) ────────────────

export type DiffToken =
  | { type: 'correct'; word: string }
  | { type: 'wrong'; word: string; expected: string }
  | { type: 'missing'; expected: string }
  | { type: 'extra'; word: string };

/**
 * Tokenise text into words (stripping punctuation for comparison only).
 * Returns the original surface form for display.
 */
function tokenise(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Compare the user's typed words against the target verse using LCS-based
 * word alignment. Produces a DiffToken[] in TARGET verse order:
 *   - correct: user word matches target word
 *   - wrong:   a user word was aligned to this target slot but doesn't match
 *   - missing: no user word aligned to this target slot (user skipped it)
 *   - extra:   user word with no target counterpart (appended at the end)
 *
 * Matching is case-insensitive and ignores punctuation, but the original
 * surface forms are kept in the returned tokens for display. Using LCS means
 * a single skipped word shows as one "missing" token instead of cascading a
 * wave of "wrong" tokens through the rest of the verse.
 */
export function diffWords(userText: string, targetText: string): DiffToken[] {
  const userWords = tokenise(userText);
  const targetWords = tokenise(targetText);
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '');

  const m = targetWords.length;
  const n = userWords.length;

  // LCS length table: dp[i][j] = LCS of targetWords[0..i) and userWords[0..j)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (norm(targetWords[i - 1]) === norm(userWords[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build the alignment. For each target word, decide whether
  // it aligned with a user word (correct/wrong) or was skipped (missing).
  // Walk target from the end; consume user words greedily.
  const aligned: { targetIdx: number; userIdx: number | null }[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (norm(targetWords[i - 1]) === norm(userWords[j - 1])) {
      aligned.push({ targetIdx: i - 1, userIdx: j - 1 });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      // target word was skipped (no user word aligned to it)
      aligned.push({ targetIdx: i - 1, userIdx: null });
      i--;
    } else {
      // user word has no target counterpart — leave it for "extra"
      j--;
    }
  }
  while (i > 0) {
    aligned.push({ targetIdx: i - 1, userIdx: null });
    i--;
  }

  aligned.reverse();

  // Build the raw token list in target order: correct (aligned) or missing.
  const result: DiffToken[] = [];
  for (const a of aligned) {
    if (a.userIdx !== null) {
      result.push({ type: 'correct', word: userWords[a.userIdx] });
    } else {
      result.push({ type: 'missing', expected: targetWords[a.targetIdx] });
    }
  }
  // Append extras (user words with no target counterpart) at the end.
  const alignedUserIdx = new Set(aligned.filter(a => a.userIdx !== null).map(a => a.userIdx!));
  const extras: string[] = [];
  for (let k = 0; k < n; k++) if (!alignedUserIdx.has(k)) extras.push(userWords[k]);
  for (const w of extras) result.push({ type: 'extra', word: w });

  // Pair up missing+extra tokens into "wrong" substitutions: a missing target
  // word paired with an extra user word means the user typed a wrong word
  // there. We greedily match each missing to the nearest unused extra (by
  // order of appearance) so a single substitution shows as one "wrong" token
  // instead of one "missing" + one "extra".
  const extraUsed = new Array(extras.length).fill(false);
  for (let k = 0; k < result.length; k++) {
    if (result[k].type !== 'missing') continue;
    // Find the nearest unused extra (first come, first served)
    for (let e = 0; e < extras.length; e++) {
      if (extraUsed[e]) continue;
      const missing = result[k] as Extract<DiffToken, { type: 'missing' }>;
      result[k] = { type: 'wrong', word: extras[e], expected: missing.expected };
      extraUsed[e] = true;
      break;
    }
  }

  // Drop extras that were paired into "wrong" tokens.
  return result.filter(t => {
    if (t.type !== 'extra') return true;
    const idx = extras.indexOf(t.word);
    // Keep only if its slot wasn't consumed
    // (if any unused extra matches this word, keep one copy)
    return !extraUsed[idx];
  });
}

/** Count correct vs total target words for scoring. */
export function diffScore(diff: DiffToken[]): { correct: number; total: number } {
  const total = diff.filter(d => d.type !== 'extra').length;
  const correct = diff.filter(d => d.type === 'correct').length;
  return { correct, total };
}
