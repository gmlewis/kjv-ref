import { describe, it, expect, beforeEach } from 'vitest';
import { getDailyGoal, updateDailyGoal } from './storage';

const KEY = 'kjv-memorize-daily-goal';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// Regression: the daily goal is day-scoped, but the storage layer used to
// return the stored goal verbatim regardless of its `date` field. A goal
// completed yesterday therefore persisted into today (and every subsequent
// day), so the Dashboard showed an already-completed goal and the
// daily-goal achievement re-fired every session. getDailyGoal must reset
// the day-scoped counters when the stored date is stale.
describe('daily goal resets across days', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resets completedVerses and completed when the stored date is stale', () => {
    localStorage.setItem(KEY, JSON.stringify({
      date: yesterdayStr(),
      targetVerses: 5,
      completedVerses: 7,
      completed: true,
    }));

    const goal = getDailyGoal();
    expect(goal.date).toBe(todayStr());
    expect(goal.completedVerses).toBe(0);
    expect(goal.completed).toBe(false);
  });

  it('preserves the user-chosen targetVerses across the reset', () => {
    localStorage.setItem(KEY, JSON.stringify({
      date: yesterdayStr(),
      targetVerses: 12,
      completedVerses: 12,
      completed: true,
    }));

    const goal = getDailyGoal();
    expect(goal.targetVerses).toBe(12);
  });

  it('persists the reset so a second read is stable', () => {
    localStorage.setItem(KEY, JSON.stringify({
      date: yesterdayStr(),
      targetVerses: 3,
      completedVerses: 10,
      completed: true,
    }));

    getDailyGoal();
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.date).toBe(todayStr());
    expect(stored.completedVerses).toBe(0);
    expect(stored.completed).toBe(false);
    expect(stored.targetVerses).toBe(3);
  });

  it('does not reset when the stored date is today', () => {
    localStorage.setItem(KEY, JSON.stringify({
      date: todayStr(),
      targetVerses: 5,
      completedVerses: 3,
      completed: false,
    }));

    const goal = getDailyGoal();
    expect(goal.completedVerses).toBe(3);
    expect(goal.completed).toBe(false);
    expect(goal.date).toBe(todayStr());
  });

  it('returns null when no goal is stored', () => {
    expect(getDailyGoal()).toBeNull();
  });

  it('treats a goal missing the date field as stale and initializes it', () => {
    // A goal imported from a settings file may not carry a `date` field.
    // It must not be treated as "today" — the counters should reset.
    localStorage.setItem(KEY, JSON.stringify({
      targetVerses: 5,
      completedVerses: 99,
      completed: true,
    }));

    const goal = getDailyGoal();
    expect(goal.date).toBe(todayStr());
    expect(goal.completedVerses).toBe(0);
    expect(goal.completed).toBe(false);
    expect(goal.targetVerses).toBe(5);
  });
});