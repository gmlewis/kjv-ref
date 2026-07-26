// Scaffold builder for the "Lamp of the Path" game mode.
//
// Pure module that turns a verse + scaffold layer into a TilePuzzle the host
// renders. Mirrors the existing Vanishing Cloze ladder (layers 0–4) and
// extends it with a layer 5 "free recall" terminal state. Determinism is
// achieved with a local seedable mulberry32 PRNG — the existing
// `practiceHelpers` signatures (which use Math.random) are left untouched.

import type { KJVVerse } from '../data/kjv-verses';
import type { ScaffoldLayer, SlotSpec, TilePuzzle, TileSpec } from './types';
import { firstLetterOf, getVanishingClozeLevel } from '../utils/practiceHelpers';

// ── Layer selection ────────────────────────────────────────────────────────────

/**
 * Decide which scaffold layer a verse should be presented at.
 *
 * Mirrors `getVanishingClozeLevel` (0–4) and adds layer 5 (free recall) for
 * mastered verses. A non-null `customLevel` overrides the recitation-based
 * ladder; `status === 'mastered'` always promotes to free recall.
 */
export function getGameLayer(
  timesRecited: number,
  customLevel?: 0 | 1 | 2 | 3 | 4 | null,
  status?: string,
): ScaffoldLayer {
  if (status === 'mastered') return 5;
  if (customLevel !== null && customLevel !== undefined) return customLevel;
  return getVanishingClozeLevel(timesRecited);
}

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────────

/**
 * mulberry32 — a tiny deterministic PRNG. Returns a function producing
 * uniformly distributed floats in [0, 1). Used in place of Math.random so
 * tile-puzzle generation is reproducible for a given seed.
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

/** Pick `count` distinct indices from [0, wordCount) deterministically. */
function pickBlankIndices(wordCount: number, count: number, rng: () => number): Set<number> {
  const all = Array.from({ length: wordCount }, (_, i) => i);
  const shuffled = seededShuffle(all, rng);
  return new Set(shuffled.slice(0, count));
}

// ── Tile puzzle builder ────────────────────────────────────────────────────────

const DEFAULT_SEED = 1;

/**
 * Build a TilePuzzle for `verse` at `layer`. When `seed` is omitted a fixed
 * default seed is used so output is still deterministic.
 */
export function buildTilePuzzle(verse: KJVVerse, layer: ScaffoldLayer, seed?: number): TilePuzzle {
  const rng = mulberry32(seed ?? DEFAULT_SEED);
  const words = verse.text.split(' ').filter(w => w.length > 0);

  const slots: SlotSpec[] = words.map((word, index) => ({
    index,
    word,
    preFilled: false,
  }));

  if (layer === 0) {
    // Study: everything shown, no tiles to drag.
    slots.forEach(s => (s.preFilled = true));
    return { layer, reference: verse.reference, slots, bank: [], freeRecall: false };
  }

  if (layer === 5) {
    // Free recall: no bank, no pre-fills; host handles typing/voice.
    return { layer, reference: verse.reference, slots, bank: [], freeRecall: true };
  }

  if (layer === 1 || layer === 2) {
    // Order mode: every slot blank, full bank of tiles.
    const tiles: TileSpec[] = words.map((word, i) => ({
      id: `t${i}`,
      word,
      display: word,
    }));
    return {
      layer,
      reference: verse.reference,
      slots,
      bank: seededShuffle(tiles, rng),
      freeRecall: false,
    };
  }

  // Layers 3 & 4: cloze tiles. Pick a deterministic set of blanked indices
  // matching the count produced by `getVanishingClozeMask` for the
  // corresponding cloze level (2 → 50%, 3 → 75%).
  const fraction = layer === 3 ? 0.5 : 0.75;
  const blankCount = Math.max(1, Math.round(words.length * fraction));
  const blanked = pickBlankIndices(words.length, blankCount, rng);

  const bankTiles: TileSpec[] = [];
  for (let i = 0; i < words.length; i++) {
    if (blanked.has(i)) {
      bankTiles.push({
        id: `t${i}`,
        word: words[i],
        display: words[i],
      });
    } else {
      slots[i].preFilled = true;
    }
  }

  return {
    layer,
    reference: verse.reference,
    slots,
    bank: seededShuffle(bankTiles, rng),
    freeRecall: false,
  };
}