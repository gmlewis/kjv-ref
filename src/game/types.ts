// Shared types for the "Lamp of the Path" game mode.
//
// This file is the contract every pure game module codes against. It is
// intentionally logic-free so that Stream A modules (scaffold, scoring,
// selection, regions, voice, state) can be built in parallel against a fixed
// shape. See `PracticeModeGameHandoff.md` §4 for the locked interface.

/** Scaffold layer a verse is presented at, mirroring the Vanishing Cloze ladder.
 *  0 Study · 1 Order (Word Bank) · 2 First-letter order · 3 Cloze tiles
 *  4 First-letter cloze · 5 Free recall (type/speak) */
export type ScaffoldLayer = 0 | 1 | 2 | 3 | 4 | 5;

/** Visual/behavioural state of a lamp on the path. `due` overlays `mastered`
 *  when a mastered verse's spaced-repetition review has come due. */
export type LampState = 'unlit' | 'learning' | 'reviewing' | 'mastered' | 'due';

/** A single slot in the tile tray: the target word at this position, and
 *  whether it is already shown (study / cloze pre-filled) or awaiting a tile. */
export interface SlotSpec {
  index: number;
  word: string;
  preFilled: boolean;
}

/** A draggable tile. `display` is what the player sees — the full word, or just
 *  the first letter at higher scaffold layers. `id` is stable for drag/drop. */
export interface TileSpec {
  id: string;
  word: string;
  display: string;
}

/** A complete tile puzzle for one verse at one scaffold layer. */
export interface TilePuzzle {
  layer: ScaffoldLayer;
  reference: string;
  /** Target order; preFilled slots are already shown to the player. */
  slots: SlotSpec[];
  /** Tiles the player drags in (shuffled). Empty for study (L0) and free recall (L5). */
  bank: TileSpec[];
  /** For layer 5: the puzzle is "free recall" — bank is empty, host shows typing/voice. */
  freeRecall: boolean;
}

/** A progress entry as read from `kjv-memorize-progress` via `useMyProgress`. */
export interface ProgressEntry {
  verse: { reference: string };
  status: string;
  timesRecited: number;
  streak: number;
  accuracy: number;
  customClozeLevel?: 0 | 1 | 2 | 3 | 4;
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
  settings: { sound: boolean; voice: boolean; motion: boolean };
}