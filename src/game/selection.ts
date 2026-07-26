// Lamp selection queue for the "Lamp of the Path" game mode.
//
// Mirrors the existing Practice.tsx session ordering: due verses first, then
// least-practiced. See `PracticeModeGameHandoff.md` §4 for the locked interface.

import type { KJVVerse } from '../data/kjv-verses';
import type { ProgressEntry, DueEntry } from './types';

export interface SelectionInput {
  /** Unlocked-region verses + built-road verses. */
  pool: KJVVerse[];
  progress: ProgressEntry[];
  due: DueEntry[];
  /** When true, only due verses are returned (the day's job is re-lighting). */
  dailyGoalCompleted: boolean;
  limit: number;
}

/**
 * Select the next lamps to present for a practice session.
 *
 * Sort order (stable):
 *   1. Due verses before non-due.
 *   2. Within each group, ascending `timesRecited` (missing → 0).
 *   3. Original pool order as the final tiebreaker.
 *
 * If `dailyGoalCompleted` is true, only due verses are returned (capped at
 * `limit`); if there are no due verses, returns `[]`.
 */
export function selectNextLamps(input: SelectionInput): KJVVerse[] {
  const { pool, progress, due, dailyGoalCompleted, limit } = input;

  const recited = new Map<string, number>();
  for (const p of progress) {
    recited.set(p.verse.reference, p.timesRecited);
  }

  const dueSet = new Set<string>();
  for (const d of due) {
    dueSet.add(d.verse.reference);
  }

  const recitationsOf = (reference: string): number =>
    recited.has(reference) ? (recited.get(reference) as number) : 0;

  const isDue = (reference: string): boolean => dueSet.has(reference);

  // Stable sort: composite key [dueGroup, timesRecited, originalIndex].
  const indexed = pool.map((verse, index) => ({ verse, index }));
  indexed.sort((a, b) => {
    const aDue = isDue(a.verse.reference) ? 0 : 1;
    const bDue = isDue(b.verse.reference) ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    const aCount = recitationsOf(a.verse.reference);
    const bCount = recitationsOf(b.verse.reference);
    if (aCount !== bCount) return aCount - bCount;
    return a.index - b.index;
  });

  let ordered = indexed.map(entry => entry.verse);

  if (dailyGoalCompleted) {
    ordered = ordered.filter(verse => isDue(verse.reference));
  }

  return ordered.slice(0, Math.max(0, limit));
}