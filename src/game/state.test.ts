import { describe, it, expect, beforeEach } from 'vitest';
import { loadGameState, saveGameState, DEFAULT_GAME_STATE, GAME_STATE_KEY } from './state';

beforeEach(() => { localStorage.clear(); });

describe('game state storage', () => {
  it('loadGameState on empty storage returns DEFAULT_GAME_STATE', () => {
    const s = loadGameState();
    expect(s).toEqual(DEFAULT_GAME_STATE);
    expect(s.settings.sound).toBe(false);
    expect(s.settings.motion).toBe(true);
  });
  it('saveGameState then loadGameState round-trips', () => {
    const state = { xp: 250, level: 2, comboBest: 7, unlockedRegionIds: ['gate'], builtRoads: [['John 3:16']], deferredRefs: ['Psalm 23:1'], settings: { sound: true, motion: false } };
    saveGameState(state);
    expect(loadGameState()).toEqual(state);
  });
  it('returns a fresh copy (not the default object)', () => {
    const a = loadGameState();
    a.xp = 999;
    expect(loadGameState().xp).toBe(0); // default unchanged
  });
  it('merges defaults for missing top-level fields', () => {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({ xp: 100 }));
    const s = loadGameState();
    expect(s.xp).toBe(100);
    expect(s.level).toBe(0);
    expect(s.comboBest).toBe(0);
    expect(s.unlockedRegionIds).toEqual([]);
    expect(s.builtRoads).toEqual([]);
  });
  it('merges defaults for missing settings', () => {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({ xp: 50, settings: { sound: true } }));
    const s = loadGameState();
    expect(s.settings.sound).toBe(true);
    expect(s.settings.motion).toBe(true);  // missing → default
  });
  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(GAME_STATE_KEY, '{not valid json');
    const s = loadGameState();
    expect(s).toEqual(DEFAULT_GAME_STATE);
  });
  it('handles non-array unlockedRegionIds as default []', () => {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({ unlockedRegionIds: 'oops' }));
    expect(loadGameState().unlockedRegionIds).toEqual([]);
  });
  it('DEFAULT_GAME_STATE has sound off and motion on', () => {
    expect(DEFAULT_GAME_STATE.settings.sound).toBe(false);
    expect(DEFAULT_GAME_STATE.settings.motion).toBe(true);
  });
});