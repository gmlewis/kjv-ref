// Scoring / XP / combo for the "Lamp of the Path" game.
//
// Pure functions only — no I/O, no Math.random(). All state changes are
// computed by callers from the values returned here.

import type { ScaffoldLayer } from './types';
import { checkWordBankAnswer, diffWords, diffScore } from '../utils/practiceHelpers';

export interface PuzzleScore {
  correct: boolean;
  accuracy: number;
}

/** Score a tile-placement puzzle against the target verse text. */
export function scoreTilePuzzle(placed: string[], target: string): PuzzleScore {
  const correct = checkWordBankAnswer(placed, target);
  if (correct) return { correct: true, accuracy: 100 };
  const { correct: correctTokens, total } = diffScore(diffWords(placed.join(' '), target));
  const accuracy = Math.max(0, Math.min(100, Math.round((correctTokens / Math.max(total, 1)) * 100)));
  return { correct: false, accuracy };
}

export type PerformanceRating = 'excellent' | 'good' | 'poor';

/** Rate the player's performance on a single puzzle attempt. */
export function performanceRating(correct: boolean, usedHint: boolean, fluent: boolean): PerformanceRating {
  if (!correct) return 'poor';
  if (!usedHint && fluent) return 'excellent';
  return 'good';
}

/** Combo counter: correct increments, wrong resets to 0. */
export function applyCombo(combo: number, correct: boolean): number {
  return correct ? combo + 1 : 0;
}

/**
 * XP awarded for a puzzle attempt. Monotonically increasing in each of:
 * layer, verseWordCount, fluency, and combo.
 */
export function computeXp(layer: ScaffoldLayer, verseWordCount: number, fluent: boolean, combo: number): number {
  const base = verseWordCount * (layer + 1) * 2;
  const fluentBonus = fluent ? Math.round(base * 0.5) : 0;
  const comboMult = 1 + Math.max(0, combo) * 0.1;
  return Math.round((base + fluentBonus) * comboMult);
}

// Level thresholds: each level requires roughly double the cumulative XP of
// the previous, starting at 100 XP for level 1.
const LEVEL_THRESHOLDS: number[] = [
  0,      // level 0
  100,    // level 1
  300,    // level 2
  700,    // level 3
  1500,   // level 4
  3000,   // level 5
  6000,   // level 6
  12000,  // level 7
  24000,  // level 8
  50000,  // level 9
  100000, // level 10
];

/** Map cumulative XP to a cosmetic level index (non-decreasing in xp). */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 0;
  let level = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i;
    else break;
  }
  // Beyond the last defined threshold, continue escalating so that very
  // large XP still yields a higher level (keeps the curve non-decreasing
  // and unbounded).
  if (xp >= LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) {
    const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    const step = last - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 2];
    level = LEVEL_THRESHOLDS.length - 1 + Math.floor((xp - last) / step);
  }
  return level;
}