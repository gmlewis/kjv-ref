// Persistence for the "Lamp of the Path" cosmetic game state.
//
// All mastery / schedule data lives in the existing `kjv-memorize-*` keys and
// is NOT duplicated here — this module only stores cosmetic progress (xp,
// level, combo, unlocked regions, built roads, and client-side settings).
//
// `loadGameState` always returns a NEW object, merged against
// `DEFAULT_GAME_STATE` so partial/corrupt storage can never break callers.

import type { GameState } from './types';

export const GAME_STATE_KEY = 'kjv-game-state';

export const DEFAULT_GAME_STATE: GameState = {
  xp: 0,
  level: 0,
  comboBest: 0,
  unlockedRegionIds: [],
  builtRoads: [],
  settings: { sound: false, voice: false, motion: true },
};

function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

function asStringArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every(x => typeof x === 'string') ? v : null;
}

function asStringArray2d(v: unknown): string[][] | null {
  return Array.isArray(v) && v.every(x => Array.isArray(x) && x.every(s => typeof s === 'string')) ? v : null;
}

/** Load the cosmetic game state from `localStorage`, merging any missing
 *  fields from `DEFAULT_GAME_STATE`. Always returns a fresh object. */
export function loadGameState(): GameState {
  const raw = localStorage.getItem(GAME_STATE_KEY);
  if (raw == null) {
    return { ...DEFAULT_GAME_STATE, unlockedRegionIds: [], builtRoads: [], settings: { ...DEFAULT_GAME_STATE.settings } };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_GAME_STATE, unlockedRegionIds: [], builtRoads: [], settings: { ...DEFAULT_GAME_STATE.settings } };
  }
  if (parsed == null || typeof parsed !== 'object') {
    return { ...DEFAULT_GAME_STATE, unlockedRegionIds: [], builtRoads: [], settings: { ...DEFAULT_GAME_STATE.settings } };
  }

  const xp = isNumber(parsed.xp) ? parsed.xp : DEFAULT_GAME_STATE.xp;
  const level = isNumber(parsed.level) ? parsed.level : DEFAULT_GAME_STATE.level;
  const comboBest = isNumber(parsed.comboBest) ? parsed.comboBest : DEFAULT_GAME_STATE.comboBest;
  const unlockedRegionIds = asStringArray(parsed.unlockedRegionIds) ?? DEFAULT_GAME_STATE.unlockedRegionIds;
  const builtRoads = asStringArray2d(parsed.builtRoads) ?? DEFAULT_GAME_STATE.builtRoads;
  const settings = {
    sound: parsed?.settings?.sound ?? DEFAULT_GAME_STATE.settings.sound,
    voice: parsed?.settings?.voice ?? DEFAULT_GAME_STATE.settings.voice,
    motion: parsed?.settings?.motion ?? DEFAULT_GAME_STATE.settings.motion,
  };

  return { xp, level, comboBest, unlockedRegionIds, builtRoads, settings };
}

/** Persist the cosmetic game state to `localStorage`. */
export function saveGameState(state: GameState): void {
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
}