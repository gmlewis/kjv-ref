import { describe, it, expect } from 'vitest';
import type {
  ScaffoldLayer,
  LampState,
  SlotSpec,
  TileSpec,
  TilePuzzle,
  ProgressEntry,
  DueEntry,
  GameState,
} from './types';

// Type-level smoke: construct samples of each shape and assert they satisfy
// the runtime structure. This guards the contract every Stream A module codes
// against — if a field is renamed or dropped, these constructions break the
// build (tsc) and the assertions break the test run.

describe('game types smoke', () => {
  it('constructs a ScaffoldLayer and LampState', () => {
    const layer: ScaffoldLayer = 3;
    const state: LampState = 'lit';
    expect(layer).toBe(3);
    expect(state).toBe('lit');
  });

  it('constructs a TilePuzzle with slots, a bank, and a decoyCount', () => {
    const puzzle: TilePuzzle = {
      layer: 1,
      reference: 'Psalm 23:1',
      slots: [
        { index: 0, word: 'The', preFilled: false },
        { index: 1, word: 'LORD', preFilled: false },
      ],
      bank: [
        { id: 't0', word: 'The', display: 'The' },
        { id: 't1', word: 'LORD', display: 'LORD' },
      ],
      decoyCount: 0,
    };
    expect(puzzle.slots.length).toBe(2);
    expect(puzzle.bank.length).toBe(2);
    expect(puzzle.decoyCount).toBe(0);
  });

  it('constructs a stage-0 read puzzle (empty bank, pre-filled slots)', () => {
    const puzzle: TilePuzzle = {
      layer: 0,
      reference: 'John 3:16',
      slots: [{ index: 0, word: 'For', preFilled: true }],
      bank: [],
      decoyCount: 0,
    };
    expect(puzzle.bank).toEqual([]);
    expect(puzzle.slots[0].preFilled).toBe(true);
  });

  it('constructs a decoy puzzle (bank larger than slot count)', () => {
    const puzzle: TilePuzzle = {
      layer: 3,
      reference: 'John 3:16',
      slots: [{ index: 0, word: 'For', preFilled: false }],
      bank: [
        { id: 't0', word: 'For', display: 'For' },
        { id: 'd0', word: 'grace', display: 'grace' },
      ],
      decoyCount: 1,
    };
    expect(puzzle.bank.length).toBeGreaterThan(puzzle.slots.length);
    expect(puzzle.decoyCount).toBe(1);
  });

  it('constructs ProgressEntry and DueEntry', () => {
    const p: ProgressEntry = {
      verse: { reference: 'John 3:16' },
      status: 'mastered',
      timesRecited: 12,
      streak: 6,
      accuracy: 95,
      customClozeLevel: 5,
    };
    const d: DueEntry = { verse: { reference: 'John 3:16' }, dueDate: '2026-08-01', interval: 7 };
    expect(p.status).toBe('mastered');
    expect(d.interval).toBe(7);
  });

  it('constructs a GameState with defaults', () => {
    const s: GameState = {
      xp: 0,
      level: 0,
      comboBest: 0,
      unlockedRegionIds: [],
      builtRoads: [],
      settings: { sound: false, motion: true },
    };
    expect(s.settings.sound).toBe(false);
    expect(s.settings.motion).toBe(true);
  });

  it('uses SlotSpec and TileSpec as standalone types', () => {
    const slot: SlotSpec = { index: 0, word: 'The', preFilled: true };
    const tile: TileSpec = { id: 't0', word: 'The', display: 'The' };
    expect(slot.preFilled).toBe(true);
    expect(tile.display).toBe('The');
  });
});