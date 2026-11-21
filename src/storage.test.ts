import { describe, it, expect, beforeEach } from 'vitest';
import { getDailyGoal, updateDailyGoal, getVerseHighlights, setVerseHighlight } from './storage';

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

// Per-verse highlight colors are a personalization saved like every other one:
// a map of verse reference → CSS color. Clicking the same color again clears it.
describe('verse highlight colors', () => {
  const HIGHLIGHTS_KEY = 'kjv-verse-highlights';

  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty map when nothing has been highlighted', () => {
    expect(getVerseHighlights()).toEqual({});
  });

  it('sets a color for a verse and persists it', () => {
    setVerseHighlight('John 3:16', '#4d7196');
    expect(getVerseHighlights()).toEqual({ 'John 3:16': '#4d7196' });
    expect(JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY)!)).toEqual({ 'John 3:16': '#4d7196' });
  });

  it('replaces an existing color for the same verse', () => {
    setVerseHighlight('John 3:16', '#4d7196');
    setVerseHighlight('John 3:16', '#a55569');
    expect(getVerseHighlights()).toEqual({ 'John 3:16': '#a55569' });
  });

  it('clears a verse highlight when passed null', () => {
    setVerseHighlight('John 3:16', '#4d7196');
    setVerseHighlight('John 3:16', null);
    expect(getVerseHighlights()).toEqual({});
  });

  it('keeps other verses highlighted when one is cleared', () => {
    setVerseHighlight('John 3:16', '#4d7196');
    setVerseHighlight('Genesis 1:1', '#3f7b4b');
    setVerseHighlight('John 3:16', null);
    expect(getVerseHighlights()).toEqual({ 'Genesis 1:1': '#3f7b4b' });
  });

  it('ignores malformed or non-hex values (e.g. from an imported file)', () => {
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify({
      'John 3:16': 'red; background: url(evil)',
      'Genesis 1:1': '#3f7b4b',
      'Psalms 23:1': 42,
    }));
    expect(getVerseHighlights()).toEqual({ 'Genesis 1:1': '#3f7b4b' });
  });

  it('returns an empty map for corrupt JSON', () => {
    localStorage.setItem(HIGHLIGHTS_KEY, 'not json');
    expect(getVerseHighlights()).toEqual({});
  });
});