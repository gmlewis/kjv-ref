// Shared types for the "Lamp of the Path" game mode.
//
// This file is the contract every pure game module codes against. It is
// intentionally logic-free so that the Stream A modules (scaffold, scoring,
// selection, regions, state) can be built in parallel against a fixed shape.
// See `PracticeModeGameHandoff.md` §4 for the locked interface.

/** Scaffold stage a verse is presented at. The game is **tap-only** (no typing,
 *  no voice): difficulty scales by adding DECOY words to the bank, never by
 *  hiding words or asking the player to type.
 *  0 Read · 1 Order · 2 Order + 2 decoys · 3 Order + 4 decoys
 *  4 Order + 6 decoys · 5 Order + 8 decoys */
export type ScaffoldLayer = 0 | 1 | 2 | 3 | 4 | 5;

/** Visual state of a lamp on the path. The path is a **per-session** journey:
 *  every lamp starts `unlit` and turns `lit` when the player resolves that verse
 *  during the current session. Lifetime mastery / due state is tracked under
 *  the hood (for region unlocks + scheduling) but is NOT painted on the path. */
export type LampState = 'unlit' | 'lit';

/** A single slot in the tile tray: the target word at this position, and
 *  whether it is already shown (stage 0 read-along) or awaiting a tile. */
export interface SlotSpec {
  index: number;
  word: string;
  preFilled: boolean;
}

/** A tappable tile. `display` is what the player sees — always the full word
 *  (the game never shows first-letter-only tiles). `id` is stable for tap/drag. */
export interface TileSpec {
  id: string;
  word: string;
  display: string;
}

/** A complete tile puzzle for one verse at one scaffold stage. */
export interface TilePuzzle {
  layer: ScaffoldLayer;
  reference: string;
  /** Target order; preFilled slots are already shown to the player (stage 0). */
  slots: SlotSpec[];
  /** Tiles the player taps in (shuffled). For stages ≥ 2 this includes decoy
   *  words that do NOT belong to the verse; the player must avoid placing them.
   *  Empty for stage 0 (read-along). */
  bank: TileSpec[];
  /** How many decoy (wrong) words are mixed into the bank. 0 for stages 0–1. */
  decoyCount: number;
}

/** A progress entry as read from `kjv-memorize-progress` via `useMyProgress`. */
export interface ProgressEntry {
  verse: { reference: string };
  status: string;
  timesRecited: number;
  streak: number;
  accuracy: number;
  /** Player-chosen scaffold stage override (0–5). `null`/absent = auto from timesRecited. */
  customClozeLevel?: 0 | 1 | 2 | 3 | 4 | 5;
}

/** A due-review entry as read from `kjv-memorize-review-schedule` via `useDueReviews`. */
export interface DueEntry {
  verse: { reference: string };
  dueDate: string;
  interval: number;
}

/** Cosmetic, game-only state persisted under `kjv-game-state`. All mastery /
 *  schedule data lives in the existing keys and is not duplicated here. */
export interface GameState {
  xp: number;
  /** Cosmetic level index (see `scoring.levelForXp`). */
  level: number;
  comboBest: number;
  unlockedRegionIds: string[];
  /** Branch roads the player has built; each is an array of reference strings. */
  builtRoads: string[][];
  /** References the player swapped out of a session ("not now") — deprioritized
   *  by `selectNextLamps` so they aren't immediately re-chosen next session.
   *  Bounded LRU; a verse is removed when it is actually resolved. */
  deferredRefs?: string[];
  settings: { sound: boolean; motion: boolean };
}