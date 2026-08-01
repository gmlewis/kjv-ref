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
  /** References the player swapped out of a recent session ("not now"). They
   *  are sorted LAST within their due group so a deferred verse isn't
   *  immediately re-chosen next session. Optional; defaults to none. */
  deferred?: string[];
}

/**
 * Select the next lamps to present for a practice session.
 *
 * Sort order:
 *   1. Due verses before non-due.
 *   2. Within each group, non-deferred verses before deferred ones (a verse the
 *      player swapped out of a recent session isn't immediately re-chosen).
 *   3. Within that, ascending `timesRecited` (missing → 0) with a small random
 *      jitter so adjacent recitation levels interleave between sessions.
 *   4. A fresh `Math.random()` key as the final tiebreaker.
 *
 * The jitter + tiebreak are random (not the original pool order) so that verses
 * which are equally — or nearly — situated appear in a fresh random order every
 * session. Without them the sort is fully deterministic and collapses to the
 * pool's file order whenever verses are equally practiced (the common case at
 * the start of a run), which made the same 12 lamps show up in the same order
 * every time.
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

  const deferredSet = new Set(input.deferred ?? []);

  const recitationsOf = (reference: string): number =>
    recited.has(reference) ? (recited.get(reference) as number) : 0;

  const isDue = (reference: string): boolean => dueSet.has(reference);
  const isDeferred = (reference: string): boolean => deferredSet.has(reference);

  // Sort by [dueGroup, deferredGroup, timesRecited+jitter, randomKey]. The
  // jitter (a fresh Math.random() per verse per call, scaled to ~2 recitations)
  // lets verses within a couple recitations of each other trade places between
  // sessions, while preserving the broad "less-practiced first" tendency. The
  // random tiebreak permutes exact equals so the selection varies between
  // sessions instead of always following pool order.
  const JITTER = 2;
  const indexed = pool.map((verse) => ({ verse, rand: Math.random() }));
  indexed.sort((a, b) => {
    const aDue = isDue(a.verse.reference) ? 0 : 1;
    const bDue = isDue(b.verse.reference) ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    const aDef = isDeferred(a.verse.reference) ? 1 : 0;
    const bDef = isDeferred(b.verse.reference) ? 1 : 0;
    if (aDef !== bDef) return aDef - bDef;
    const aKey = recitationsOf(a.verse.reference) + a.rand * JITTER;
    const bKey = recitationsOf(b.verse.reference) + b.rand * JITTER;
    if (aKey !== bKey) return aKey - bKey;
    return a.rand - b.rand;
  });

  let ordered = indexed.map(entry => entry.verse);

  if (dailyGoalCompleted) {
    ordered = ordered.filter(verse => isDue(verse.reference));
  }

  return ordered.slice(0, Math.max(0, limit));
}