// LocalStorage-based storage for user progress, sessions, achievements, and bookmarks

// Storage keys
const STORAGE_KEYS = {
  PROGRESS: 'kjv-memorize-progress',
  SESSIONS: 'kjv-memorize-sessions',
  ACHIEVEMENTS: 'kjv-memorize-achievements',
  BOOKMARKS: 'kjv-memorize-bookmarks',
  DAILY_GOAL: 'kjv-memorize-daily-goal',
  REVIEW_SCHEDULE: 'kjv-memorize-review-schedule',
  VERSE_HIGHLIGHTS: 'kjv-verse-highlights'
};

// Initialize storage with default values if not present
export function initializeStorage() {
  if (typeof window === 'undefined') return;
  
  // Progress storage
  if (!localStorage.getItem(STORAGE_KEYS.PROGRESS)) {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify([]));
  }
  
  // Sessions storage
  if (!localStorage.getItem(STORAGE_KEYS.SESSIONS)) {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
  }
  
  // Achievements storage
  if (!localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS)) {
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify([]));
  }
  
  // Bookmarks storage
  if (!localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) {
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify([]));
  }
  
  // Daily goal storage
  if (!localStorage.getItem(STORAGE_KEYS.DAILY_GOAL)) {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEYS.DAILY_GOAL, JSON.stringify({
      date: today,
      targetVerses: 5,
      completedVerses: 0,
      completed: false
    }));
  }
  
  // Review schedule storage
  if (!localStorage.getItem(STORAGE_KEYS.REVIEW_SCHEDULE)) {
    localStorage.setItem(STORAGE_KEYS.REVIEW_SCHEDULE, JSON.stringify([]));
  }

  // Per-verse highlight colors (reference → color hex)
  if (!localStorage.getItem(STORAGE_KEYS.VERSE_HIGHLIGHTS)) {
    localStorage.setItem(STORAGE_KEYS.VERSE_HIGHLIGHTS, JSON.stringify({}));
  }
}

// Get all progress entries
export function getProgress(): any[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
  return data ? JSON.parse(data) : [];
}

// Save progress entries
export function setProgress(progress: any[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
}

// Get all sessions
export function getSessions(): any[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
}

// Save sessions
export function setSessions(sessions: any[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
}

// Get all achievements
export function getAchievements(): any[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
  return data ? JSON.parse(data) : [];
}

// Save achievements
export function setAchievements(achievements: any[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
}

// Get all bookmarks
export function getBookmarks(): any[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
  return data ? JSON.parse(data) : [];
}

// Save bookmarks
export function setBookmarks(bookmarks: any[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
}

// Add a bookmark
export function addBookmark(bookmark: any): void {
  if (typeof window === 'undefined') return;
  const bookmarks = getBookmarks();
  bookmarks.push(bookmark);
  setBookmarks(bookmarks);
}

// Remove a bookmark by reference
export function removeBookmarkByReference(reference: string): void {
  if (typeof window === 'undefined') return;
  const bookmarks = getBookmarks();
  const filtered = bookmarks.filter(b => b.reference !== reference);
  setBookmarks(filtered);
}

// Get daily goal
export function getDailyGoal(): any {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.DAILY_GOAL);
  if (!data) return null;
  const goal = JSON.parse(data);
  if (!goal || typeof goal !== 'object') return null;
  // The daily goal is day-scoped: a goal completed yesterday must not still
  // show as completed today. When the stored date is stale (or missing, e.g.
  // from an imported settings file), reset the day-scoped counters while
  // preserving the user's chosen targetVerses, and persist the reset so the
  // Dashboard and practice flow see a consistent value.
  const today = new Date().toISOString().split('T')[0];
  if (goal.date !== today) {
    goal.date = today;
    goal.completedVerses = 0;
    goal.completed = false;
    updateDailyGoal(goal);
  }
  return goal;
}

// Update daily goal
export function updateDailyGoal(goal: any): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DAILY_GOAL, JSON.stringify(goal));
}

// Get review schedule
export function getReviewSchedule(): any[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.REVIEW_SCHEDULE);
  return data ? JSON.parse(data) : [];
}

// Save review schedule
export function setReviewSchedule(schedule: any[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.REVIEW_SCHEDULE, JSON.stringify(schedule));
}

// ─── Per-verse highlight colors ──────────────────────────────────────────────
//
// Stored as a plain map of verse reference → CSS color (e.g.
// { "John 3:16": "#4d7196" }). A reference with no entry is unhighlighted.
// Values are validated on read so a hand-edited or imported settings file
// cannot inject arbitrary strings that would be written into inline styles.

export const VERSE_HIGHLIGHTS_KEY = STORAGE_KEYS.VERSE_HIGHLIGHTS;

export function getVerseHighlights(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(STORAGE_KEYS.VERSE_HIGHLIGHTS);
    if (!data) return {};
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [reference, color] of Object.entries(parsed)) {
      // Only accept simple hex colors (#rgb / #rrggbb / #rrggbbaa).
      if (typeof color === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
        result[reference] = color;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function setVerseHighlights(highlights: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.VERSE_HIGHLIGHTS, JSON.stringify(highlights));
}

/**
 * Set (or, when `color` is null, clear) the highlight color for one verse.
 * Returns the updated map so callers can update React state synchronously.
 */
export function setVerseHighlight(reference: string, color: string | null): Record<string, string> {
  const highlights = getVerseHighlights();
  if (color === null) {
    delete highlights[reference];
  } else {
    highlights[reference] = color;
  }
  setVerseHighlights(highlights);
  return highlights;
}

// Add or update a review schedule entry (matched by verse reference)
export function upsertReviewSchedule(entry: any): void {
  if (typeof window === 'undefined') return;
  const schedule = getReviewSchedule();
  const index = schedule.findIndex((e: any) => e.verse?.reference === entry.verse?.reference);
  if (index >= 0) {
    schedule[index] = entry;
  } else {
    schedule.push(entry);
  }
  setReviewSchedule(schedule);
}
