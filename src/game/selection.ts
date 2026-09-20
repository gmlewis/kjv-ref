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
 * Drop later verses that repeat an earlier verse's reference, preserving order.
 *
 * A session's lamps are drawn from one queue and every lamp must show a verse
 * the player has not seen yet this session, so a pool that carries a repeat (a
 * custom road built from a list that names the same verse twice, say) must not
 * be able to put one verse on two lamps.
 */
export function distinctVerses(verses: KJVVerse[]): KJVVerse[] {
  const seen = new Set<string>();
  const out: KJVVerse[] = [];
  for (const v of verses) {
    if (seen.has(v.reference)) continue;
    seen.add(v.reference);
    out.push(v);
  }
  return out;
}

/**
 * Swap the verse(s) occupying the current lamp's queue slot for `replacement`.
 *
 * `replacement` must NOT already be in `queue` — the caller guarantees it by
 * picking an unused verse (see `swapCurrentVerse`). The replacement takes the
 * slot **in place** and the skipped verse(s) are dropped, so for a single-verse
 * lamp the queue length is preserved. That is what keeps the session winnable:
 * a session is complete once `queueIndex >= queue.length`, so a swap that
 * lengthened the queue would push the final lamp permanently out of reach and
 * the game would cycle forever. (A chain slot collapses the queue by
 * `chainLen - 1`, since one verse replaces several.)
 *
 * The skipped verse(s) are dropped from the queue entirely rather than
 * re-appended: the player said "not now", so they must not reappear for the
 * rest of this game. They are returned as `skipped` so the caller can defer
 * them (sort-last next session) and exclude them from later swaps.
 *
 * `start` is clamped into range so a stale/negative offset can't splice from
 * the end of the queue.
 */
export function replaceQueueSlot(
  queue: KJVVerse[],
  start: number,
  chainLen: number,
  replacement: KJVVerse,
): { queue: KJVVerse[]; skipped: string[] } {
  const next = [...queue];
  const at = Math.max(0, Math.min(start, next.length));
  const len = Math.max(1, Math.min(chainLen, next.length - at));
  const removed = next.splice(at, len);
  next.splice(at, 0, replacement);
  return { queue: next, skipped: removed.map((v) => v.reference) };
}

/**
 * Swap the verse(s) at the current lamp's slot for a verse that is ALREADY in
 * the queue, by **moving** it: the replacement is lifted out of its position in
 * the queue and re-inserted at the current slot. Nothing is duplicated, so the
 * player never meets the same verse twice in one session.
 *
 * This is the fallback for when the pool holds no verse the player hasn't
 * already been shown — every remaining verse is either queued, lit, or skipped
 * (a custom road shorter than a session, say). The queue then ends up
 * `chainLen` verses shorter, i.e. the session finishes one lamp early rather
 * than repeating a verse; the `queueIndex >= queue.length` win condition already
 * handles a short queue.
 *
 * The skipped verse(s) are returned as `skipped`, exactly as
 * {@link replaceQueueSlot} reports them.
 */
export function moveQueueSlot(
  queue: KJVVerse[],
  start: number,
  chainLen: number,
  replacement: KJVVerse,
): { queue: KJVVerse[]; skipped: string[] } {
  const next = [...queue];
  const at = Math.max(0, Math.min(start, next.length));
  const from = next.findIndex((v) => v.reference === replacement.reference);
  if (from < 0) return { queue: next, skipped: [] };
  // The replacement has to come from the current lamp onwards. Lifting an
  // earlier one out would shift the slot left, and this helper cannot re-anchor
  // the caller's `queueIndex` to match: the caller would keep pointing at the
  // slot index, which now holds the verse after the slot, and re-present a verse
  // the player has already seen — the exact repeat this path exists to prevent.
  // Refuse the move rather than shuffle the queue into that state.
  if (from < at) return { queue: next, skipped: [] };
  const len = Math.max(1, Math.min(chainLen, next.length - at));
  next.splice(from, 1);
  const removed = next.splice(at, len);
  next.splice(at, 0, replacement);
  return { queue: next, skipped: removed.map((v) => v.reference) };
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

  // Distinct: a session's lamps are one verse each, so a pool carrying a repeat
  // must not be able to fill two lamps with the same verse.
  return distinctVerses(ordered).slice(0, Math.max(0, limit));
}
