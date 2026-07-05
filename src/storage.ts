// LocalStorage-based storage solution to replace Prophet entities

// Storage keys
const STORAGE_KEYS = {
  PROGRESS: 'kjv-memorize-progress',
  SESSIONS: 'kjv-memorize-sessions',
  ACHIEVEMENTS: 'kjv-memorize-achievements',
  BOOKMARKS: 'kjv-memorize-bookmarks',
  DAILY_GOAL: 'kjv-memorize-daily-goal',
  REVIEW_SCHEDULE: 'kjv-memorize-review-schedule'
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
  return data ? JSON.parse(data) : null;
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

// Add or update a review schedule entry
export function upsertReviewSchedule(entry: any): void {
  if (typeof window === 'undefined') return;
  const schedule = getReviewSchedule();
  const index = schedule.findIndex((e: any) => e.verse?.id === entry.verse?.id);
  if (index >= 0) {
    schedule[index] = entry;
  } else {
    schedule.push(entry);
  }
  setReviewSchedule(schedule);
}