// ── Voice recitation fuzzy match ──────────────────────────────────────────────

/**
 * Normalise text the same way `checkWordBankAnswer` does:
 * lowercase, strip non-alpha (keep spaces), collapse whitespace, trim.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function wordCounts(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return counts;
}

/**
 * Compare a spoken transcript against a target verse.
 *
 * `overlap` is the multiset intersection size divided by the target word
 * count: for each unique word, take `min(countInTarget, countInTranscript)`,
 * sum those mins, then divide by the total number of target words. This is
 * order-insensitive, case-insensitive, and punctuation-insensitive. Result is
 * in [0, 1].
 *
 * `match` is `overlap >= (threshold ?? 0.85)`. An empty target yields
 * overlap 0 and match false (avoiding divide-by-zero).
 */
export function matchRecitation(
  transcript: string,
  target: string,
  threshold?: number,
): { match: boolean; overlap: number } {
  const targetWords = normalise(target).split(' ').filter(w => w.length > 0);
  if (targetWords.length === 0) return { match: false, overlap: 0 };

  const transcriptWords = normalise(transcript).split(' ').filter(w => w.length > 0);
  const transcriptCounts = wordCounts(transcriptWords);

  let intersection = 0;
  for (const [word, count] of wordCounts(targetWords)) {
    intersection += Math.min(count, transcriptCounts.get(word) ?? 0);
  }

  const overlap = intersection / targetWords.length;
  const t = threshold ?? 0.85;
  return { match: overlap >= t, overlap };
}