import { describe, it, expect } from 'vitest';
import { selectNextLamps, replaceQueueSlot } from './selection';
import { KJV_VERSES } from '../data/kjv-verses';
import type { ProgressEntry, DueEntry } from './types';

const ref = (r: string) => KJV_VERSES.find(v => v.reference === r)!;
const pool = [ref('John 3:16'), ref('Psalm 23:1'), ref('Genesis 1:1'), ref('Romans 8:28'), ref('Philippians 4:13')];

describe('selectNextLamps', () => {
  it('returns due verses first', () => {
    const progress: ProgressEntry[] = [
      { verse: { reference: 'John 3:16' }, status: 'reviewing', timesRecited: 5, streak: 2, accuracy: 90 },
      { verse: { reference: 'Psalm 23:1' }, status: 'reviewing', timesRecited: 1, streak: 1, accuracy: 80 },
    ];
    const due: DueEntry[] = [{ verse: { reference: 'Psalm 23:1' }, dueDate: '2026-07-20', interval: 3 }];
    const out = selectNextLamps({ pool, progress, due, dailyGoalCompleted: false, limit: 10 });
    expect(out[0].reference).toBe('Psalm 23:1'); // due first
  });

  it('among non-due, lower timesRecited first', () => {
    const progress: ProgressEntry[] = [
      { verse: { reference: 'John 3:16' }, status: 'learning', timesRecited: 5, streak: 1, accuracy: 70 },
      { verse: { reference: 'Genesis 1:1' }, status: 'learning', timesRecited: 0, streak: 0, accuracy: 0 },
    ];
    const out = selectNextLamps({ pool, progress, due: [], dailyGoalCompleted: false, limit: 10 });
    const idxJohn = out.findIndex(v => v.reference === 'John 3:16');
    const idxGen = out.findIndex(v => v.reference === 'Genesis 1:1');
    expect(idxGen).toBeLessThan(idxJohn); // 0 recitations before 5
  });

  it('respects limit', () => {
    const out = selectNextLamps({ pool, progress: [], due: [], dailyGoalCompleted: false, limit: 2 });
    expect(out.length).toBe(2);
  });

  it('dailyGoalCompleted returns only due verses', () => {
    const due: DueEntry[] = [{ verse: { reference: 'Romans 8:28' }, dueDate: '2026-07-20', interval: 3 }];
    const out = selectNextLamps({ pool, progress: [], due, dailyGoalCompleted: true, limit: 10 });
    expect(out.length).toBe(1);
    expect(out[0].reference).toBe('Romans 8:28');
  });

  it('dailyGoalCompleted with no due returns empty', () => {
    const out = selectNextLamps({ pool, progress: [], due: [], dailyGoalCompleted: true, limit: 10 });
    expect(out).toEqual([]);
  });

  it('verse with no progress entry is treated as 0 recitations', () => {
    const out = selectNextLamps({ pool, progress: [], due: [], dailyGoalCompleted: false, limit: 10 });
    expect(out.length).toBe(pool.length);
  });

  it('limit caps after daily-goal filter', () => {
    const due: DueEntry[] = [
      { verse: { reference: 'Romans 8:28' }, dueDate: '2026-07-20', interval: 3 },
      { verse: { reference: 'Philippians 4:13' }, dueDate: '2026-07-20', interval: 3 },
    ];
    const out = selectNextLamps({ pool, progress: [], due, dailyGoalCompleted: true, limit: 1 });
    expect(out.length).toBe(1);
  });
});

describe('replaceQueueSlot', () => {
  // A 12-lamp session, as the engine builds it.
  const session = () => KJV_VERSES.slice(0, 12);

  it('keeps the queue length, so the win condition stays reachable', () => {
    const queue = session();
    const { queue: next, skipped } = replaceQueueSlot(queue, 11, 1, ref('John 3:16'));
    expect(next.length).toBe(queue.length);
    expect(skipped).toEqual([queue[11].reference]);
  });

  it('does not re-append the skipped verse (it must not reappear this game)', () => {
    const queue = session();
    const skipRef = queue[11].reference;
    const { queue: next } = replaceQueueSlot(queue, 11, 1, ref('John 3:16'));
    expect(next.map(v => v.reference)).not.toContain(skipRef);
  });

  it('lets the final lamp be solved and complete the session', () => {
    // queueIndex is 12 (the last lamp is on screen) and the player skips it.
    const queue = session();
    const queueIndex = 12;
    const start = queueIndex - 1;
    const { queue: next } = replaceQueueSlot(queue, start, 1, ref('John 3:16'));

    // The engine advances to start + 1 after a swap, then nextPuzzle() checks
    // `queueIndex >= queue.length`. Before the fix the queue grew to 13, so the
    // check never passed and the game cycled forever.
    const nextQueueIndex = start + 1;
    expect(nextQueueIndex).toBe(12);
    expect(nextQueueIndex).toBeGreaterThanOrEqual(next.length);
  });

  it('preserves the original queue (no in-place mutation)', () => {
    const queue = session();
    const before = queue.map(v => v.reference);
    replaceQueueSlot(queue, 0, 1, ref('John 3:16'));
    expect(queue.map(v => v.reference)).toEqual(before);
  });

  it('collapses a multi-verse chain slot to a single replacement', () => {
    const queue = session();
    const { queue: next, skipped } = replaceQueueSlot(queue, 4, 3, ref('John 3:16'));
    expect(skipped.length).toBe(3);
    expect(next.length).toBe(queue.length - 2);
    expect(next[4].reference).toBe('John 3:16');
  });

  it('clamps an out-of-range start instead of splicing from the end', () => {
    const queue = session();
    const { queue: next, skipped } = replaceQueueSlot(queue, -5, 1, ref('John 3:16'));
    expect(next.length).toBe(queue.length);
    expect(next[0].reference).toBe('John 3:16');
    expect(skipped).toEqual([queue[0].reference]);
  });
});