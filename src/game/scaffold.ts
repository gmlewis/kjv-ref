// Scaffold builder for the "Lamp of the Path" game mode.
//
// Pure module that turns a verse + scaffold stage into a TilePuzzle the engine
// renders. The game is **tap-only**: the player taps/drags word tiles into the
// correct order. Difficulty scales by adding DECOY (wrong) words to the tile
// bank — never by hiding words, showing first letters, or asking the player to
// type. Determinism is achieved with a local seedable mulberry32 PRNG; the
// existing `practiceHelpers` signatures (which use Math.random) are untouched.

import type { KJVVerse } from '../data/kjv-verses';
import type { ScaffoldLayer, SlotSpec, TilePuzzle, TileSpec } from './types';

// ── Stage selection ────────────────────────────────────────────────────────────

/**
 * Decide which scaffold stage a verse should be presented at.
 *
 * Stages (tap-only; difficulty = decoy count):
 *   0 Read · 1 Order · 2 +2 decoys · 3 +4 decoys · 4 +6 decoys · 5 +8 decoys
 *
 * A non-null `customLevel` (player-chosen override) ALWAYS wins — even over
 * `mastered` — so the player can drop any verse back to any stage, including
 * stage 0, and have it remembered (mirrors the Vanishing Cloze override).
 * Otherwise a `mastered` verse is presented at the hardest stage (5); failing
 * that, the stage auto-advances with `timesRecited`.
 */
export function getGameLayer(
  timesRecited: number,
  customLevel?: 0 | 1 | 2 | 3 | 4 | 5 | null,
  status?: string,
): ScaffoldLayer {
  if (customLevel !== null && customLevel !== undefined) return customLevel;
  if (status === 'mastered') return 5;
  return stageForRecited(timesRecited);
}

/** Map recitation count → auto stage (no override, not mastered). */
function stageForRecited(timesRecited: number): ScaffoldLayer {
  if (timesRecited <= 0) return 0; // first encounter: read-along
  if (timesRecited <= 2) return 1; // order
  if (timesRecited <= 4) return 2; // +2 decoys
  if (timesRecited <= 6) return 3; // +4 decoys
  if (timesRecited <= 9) return 4; // +6 decoys
  return 5; // +8 decoys
}

// ── Decoy counts per stage ────────────────────────────────────────────────────

/** Number of wrong-word decoys mixed into the bank at each stage. */
const DECOY_COUNTS: Record<ScaffoldLayer, number> = { 0: 0, 1: 0, 2: 2, 3: 4, 4: 6, 5: 8 };

/** How many decoy words belong in the bank for `stage`. */
export function decoyCountFor(stage: ScaffoldLayer): number {
  return DECOY_COUNTS[stage] ?? 0;
}

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────────

/**
 * mulberry32 — a tiny deterministic PRNG. Returns a function producing
 * uniformly distributed floats in [0, 1). Used in place of Math.random so
 * tile-puzzle generation (including decoy selection) is reproducible for a
 * given seed.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by a seeded PRNG. */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Lowercase + strip non-alphanumerics, for word comparisons. */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Pick `count` distinct decoy words from `pool` that do NOT appear in the
 * verse (normalized comparison). Returns TileSpecs with stable `dN` ids. If the
 * pool is too small or empty, returns as many as possible (may be < count).
 */
function pickDecoys(pool: string[], verseWords: string[], count: number, rng: () => number): TileSpec[] {
  if (count <= 0) return [];
  const verseSet = new Set(verseWords.map(normalizeWord));
  // Deduplicate pool by normalized form; exclude any word in the verse.
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const w of pool) {
    const n = normalizeWord(w);
    if (!n || verseSet.has(n) || seen.has(n)) continue;
    seen.add(n);
    candidates.push(w);
  }
  const chosen = seededShuffle(candidates, rng).slice(0, count);
  return chosen.map((w, i) => ({ id: `d${i}`, word: w, display: w }));
}

// ── Tile puzzle builder ────────────────────────────────────────────────────────

const DEFAULT_SEED = 1;

/**
 * Build a TilePuzzle for `verse` at `stage`. When `seed` is omitted `Math.random`
 * is used to truly randomize word tile positions every run. When `seed` is provided
 * (e.g. in unit tests), a deterministic PRNG is used. `decoyPool` is the candidate
 * word pool from which decoy (wrong) tiles are drawn for stages ≥ 2.
 */
export function buildTilePuzzle(
  verse: KJVVerse,
  stage: ScaffoldLayer,
  seed?: number,
  decoyPool?: string[],
): TilePuzzle {
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const words = verse.text.split(' ').filter((w) => w.length > 0);

  const slots: SlotSpec[] = words.map((word, index) => ({
    index,
    word,
    preFilled: false,
  }));

  // Stage 0 — Read: the whole verse is shown pre-placed; the player just reads
  // it and taps to continue. No tiles to arrange.
  if (stage === 0) {
    slots.forEach((s) => (s.preFilled = true));
    return { layer: 0, reference: verse.reference, slots, bank: [], decoyCount: 0 };
  }

  // Stages 1–5 — Order (with decoys from stage 2 up): every slot blank, the
  // bank holds the verse's words plus `decoyCount` wrong words.
  const verseTiles: TileSpec[] = words.map((word, i) => ({
    id: `t${i}`,
    word,
    display: word,
  }));
  const decoyCount = decoyCountFor(stage);
  const decoys = pickDecoys(decoyPool ?? [], words, decoyCount, rng);
  const bank = seededShuffle([...verseTiles, ...decoys], rng);

  return {
    layer: stage,
    reference: verse.reference,
    slots,
    bank,
    decoyCount: decoys.length,
  };
}