// React hooks with localStorage implementations
import { useState, useEffect, useCallback } from 'react';
import { 
  getProgress, setProgress,
  getSessions, setSessions,
  getAchievements, setAchievements,
  getBookmarks, setBookmarks, addBookmark, removeBookmarkByReference,
  getDailyGoal, updateDailyGoal,
  getReviewSchedule, setReviewSchedule, upsertReviewSchedule,
  initializeStorage
} from './storage';

// Dispatch a custom event so same-tab hooks can re-read localStorage after mutations.
// (The native 'storage' event only fires cross-tab.)
export function notifyStorageChange(key: string) {
  window.dispatchEvent(new CustomEvent('kjv-storage-change', { detail: { key } }));
}

function useStorageRefresh(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.key === key) callback();
    };
    window.addEventListener('kjv-storage-change', handler);
    return () => window.removeEventListener('kjv-storage-change', handler);
  }, [key, callback]);
}

// Initialize storage on first use
let storageInitialized = false;
export function useStorageInitializer() {
  useEffect(() => {
    if (!storageInitialized && typeof window !== 'undefined') {
      initializeStorage();
      storageInitialized = true;
    }
  }, []);
}

// useSubscribe replacement that returns [data, loading, error]
export function useSubscribe<T>(initialData: T[] = []): [T[] | null, boolean, { code: string; message?: string } | null] {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message?: string } | null>(null);
  
  // Storage initializer
  useStorageInitializer();
  
  // Load data on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        setLoading(true);
        // Simulate async loading
        await new Promise(resolve => setTimeout(resolve, 10));
        if (isMounted) {
          setData([] as unknown as T[]); // Will be overwritten by specific hooks
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError({ code: 'LOAD_ERROR', message: String(err) });
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  return [data, loading, error];
}


// Specific hooks for each entity type
export function useMyProgress(): [any[] | null, boolean, { code: string; message?: string } | null] {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message?: string } | null>(null);
  
  useStorageInitializer();
  
  useEffect(() => {
    let isMounted = true;
    const loadProgress = async () => {
      try {
        setLoading(true);
        const progress = getProgress();
        if (isMounted) {
          setData(progress);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError({ code: 'LOAD_ERROR', message: String(err) });
          setLoading(false);
        }
      }
    };
    
    loadProgress();
    
    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kjv-memorize-progress' && isMounted) {
        setData(JSON.parse(e.newValue || '[]'));
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      isMounted = false;
    };
  }, []);
  
  const refreshProgress = useCallback(() => setData(getProgress()), []);
  useStorageRefresh('kjv-memorize-progress', refreshProgress);
  
  return [data, loading, error];
}

export function useMySessions(): [any[] | null, boolean, { code: string; message?: string } | null] {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message?: string } | null>(null);
  
  useStorageInitializer();
  
  useEffect(() => {
    let isMounted = true;
    const loadSessions = async () => {
      try {
        setLoading(true);
        const sessions = getSessions();
        if (isMounted) {
          setData(sessions);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError({ code: 'LOAD_ERROR', message: String(err) });
          setLoading(false);
        }
      }
    };
    
    loadSessions();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kjv-memorize-sessions' && isMounted) {
        setData(JSON.parse(e.newValue || '[]'));
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      isMounted = false;
    };
  }, []);
  
  const refreshSessions = useCallback(() => setData(getSessions()), []);
  useStorageRefresh('kjv-memorize-sessions', refreshSessions);
  
  return [data, loading, error];
}

export function useMyAchievements(): [any[] | null, boolean, { code: string; message?: string } | null] {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message?: string } | null>(null);
  
  useStorageInitializer();
  
  useEffect(() => {
    let isMounted = true;
    const loadAchievements = async () => {
      try {
        setLoading(true);
        const achievements = getAchievements();
        if (isMounted) {
          setData(achievements);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError({ code: 'LOAD_ERROR', message: String(err) });
          setLoading(false);
        }
      }
    };
    
    loadAchievements();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kjv-memorize-achievements' && isMounted) {
        setData(JSON.parse(e.newValue || '[]'));
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      isMounted = false;
    };
  }, []);
  
  const refreshAchievements = useCallback(() => setData(getAchievements()), []);
  useStorageRefresh('kjv-memorize-achievements', refreshAchievements);
  
  return [data, loading, error];
}

export function useMyBookmarks(): [any[] | null, boolean, { code: string; message?: string } | null] {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message?: string } | null>(null);
  
  useStorageInitializer();
  
  useEffect(() => {
    let isMounted = true;
    const loadBookmarks = async () => {
      try {
        setLoading(true);
        const bookmarks = getBookmarks();
        if (isMounted) {
          setData(bookmarks);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError({ code: 'LOAD_ERROR', message: String(err) });
          setLoading(false);
        }
      }
    };
    
    loadBookmarks();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kjv-memorize-bookmarks' && isMounted) {
        setData(JSON.parse(e.newValue || '[]'));
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      isMounted = false;
    };
  }, []);
  
  const refreshBookmarks = useCallback(() => setData(getBookmarks()), []);
  useStorageRefresh('kjv-memorize-bookmarks', refreshBookmarks);
  
  return [data, loading, error];
}

export function useDueReviews(): [any[] | null, boolean, { code: string; message?: string } | null] {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message?: string } | null>(null);
  
  useStorageInitializer();
  
  useEffect(() => {
    let isMounted = true;
    const loadDueReviews = async () => {
      try {
        setLoading(true);
        const schedule = getReviewSchedule();
        // Filter for due reviews (today or past due)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueReviews = schedule.filter((entry: any) => {
          const dueDate = new Date(entry.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate <= today;
        });
        if (isMounted) {
          setData(dueReviews);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError({ code: 'LOAD_ERROR', message: String(err) });
          setLoading(false);
        }
      }
    };
    
    loadDueReviews();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kjv-memorize-review-schedule' && isMounted) {
        const schedule = JSON.parse(e.newValue || '[]');
        // Filter for due reviews
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueReviews = schedule.filter((entry: any) => {
          const dueDate = new Date(entry.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate <= today;
        });
        if (isMounted) {
          setData(dueReviews);
          setLoading(false);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      isMounted = false;
    };
  }, []);
  
  const refreshDueReviews = useCallback(() => {
    const schedule = getReviewSchedule();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setData(schedule.filter((entry: any) => {
      const dueDate = new Date(entry.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate <= today;
    }));
  }, []);
  useStorageRefresh('kjv-memorize-review-schedule', refreshDueReviews);
  
  return [data, loading, error];
}

// Mutation hooks
export function useCreateSessionMutation() {
  return useMutation(async (args: { versesPracticed: string[]; mode: string; score: number; totalQuestions: number }) => {
    // Create a session object
    const session = {
      id: Date.now().toString(),
      user: { id: 'anonymous' },
      versesPracticed: args.versesPracticed,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      mode: args.mode,
      score: args.score,
      totalQuestions: args.totalQuestions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to sessions
    const sessions = getSessions();
    sessions.push(session);
    setSessions(sessions);
    notifyStorageChange('kjv-memorize-sessions');
    
    return session.id;
  });
}

export function useAwardAchievementMutation() {
  return useMutation(async (args: { type: string; verseCount?: number; book?: any }) => {
    // Create an achievement object
    const achievement = {
      id: Date.now().toString(),
      user: { id: 'anonymous' },
      type: args.type,
      earnedAt: new Date().toISOString(),
      verseCount: args.verseCount ?? null,
      book: args.book ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to achievements
    const achievements = getAchievements();
    achievements.push(achievement);
    setAchievements(achievements);
    notifyStorageChange('kjv-memorize-achievements');
    
    return achievement.id;
  });
}

// Progress mutation hook
export function useUpdateProgressMutation() {
  return useMutation(async (args: {
    reference: string;
    correct: boolean;
    accuracy: number;
  }) => {
    const { reference, correct, accuracy } = args;
    const progress = getProgress();
    const existing = progress.find((p: any) => p?.verse?.reference === reference);
    if (existing) {
      existing.timesRecited = (existing.timesRecited ?? 0) + 1;
      existing.lastPracticed = new Date().toISOString();
      if (correct) {
        existing.streak = (existing.streak ?? 0) + 1;
        existing.accuracy = Math.round(((existing.accuracy ?? 0) * (existing.timesRecited - 1) + accuracy) / existing.timesRecited);
        if (existing.streak >= 5 && existing.accuracy >= 90) existing.status = 'mastered';
        else if (existing.streak >= 2 || existing.accuracy >= 70) existing.status = 'reviewing';
        else existing.status = 'learning';
      } else {
        existing.streak = 0;
        existing.accuracy = Math.round(((existing.accuracy ?? 0) * (existing.timesRecited - 1) + accuracy) / existing.timesRecited);
        existing.status = 'learning';
      }
    } else {
      progress.push({
        id: Date.now().toString(),
        user: { id: 'anonymous' },
        verse: { reference },
        status: correct ? (accuracy >= 90 ? 'reviewing' : 'learning') : 'learning',
        timesRecited: 1,
        lastPracticed: new Date().toISOString(),
        nextReview: null,
        accuracy,
        streak: correct ? 1 : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setProgress(progress);
    notifyStorageChange('kjv-memorize-progress');
    return reference;
  });
}

// Review schedule mutation hook
export function useUpsertReviewScheduleMutation() {
  return useMutation(async (args: {
    reference: string;
    correct: boolean;
    streak: number;
    accuracy: number;
  }) => {
    const { reference, correct, streak, accuracy } = args;
    let interval: number;
    if (!correct) {
      interval = 1;
    } else if (streak <= 1) {
      interval = 1;
    } else if (streak === 2) {
      interval = 3;
    } else {
      interval = Math.min(Math.round(streak * accuracy / 50), 30);
    }
    const easeFactor = 2.5 + (accuracy - 60) / 100;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + interval);
    upsertReviewSchedule({
      verse: { reference },
      interval,
      easeFactor: Math.max(1.3, Math.min(easeFactor, 3.0)),
      dueDate: dueDate.toISOString(),
      reviewsCompleted: streak,
    });
    notifyStorageChange('kjv-memorize-review-schedule');
    return reference;
  });
}

// Daily goal mutation hook
export function useUpdateDailyGoalMutation() {
  return useMutation(async (args: { completedVerses: number }) => {
    const goal = getDailyGoal();
    if (!goal) return;
    goal.completedVerses = args.completedVerses;
    goal.completed = args.completedVerses >= goal.targetVerses;
    updateDailyGoal(goal);
    return goal;
  });
}

// Bookmark mutation hooks
export function useCreateBookmarkMutation() {
  return useMutation(async (args: { reference: string }) => {
    // Create a bookmark object
    const bookmark = {
      id: Date.now().toString(),
      user: { id: 'anonymous' },
      reference: args.reference,
      addedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to bookmarks
    const bookmarks = getBookmarks();
    bookmarks.push(bookmark);
    setBookmarks(bookmarks);
    notifyStorageChange('kjv-memorize-bookmarks');
    
    return bookmark.id;
  });
}

export function useRemoveBookmarkMutation() {
  return useMutation(async (args: { bookmark: { id: string } }) => {
    // Remove bookmark by id
    const bookmarks = getBookmarks();
    const filtered = bookmarks.filter(b => b.id !== args.bookmark.id);
    setBookmarks(filtered);
    notifyStorageChange('kjv-memorize-bookmarks');
    
    return true;
  });
}

// useMutation replacement
export function useMutation<TArgs, TReturns>(mutateFn: (args: TArgs) => Promise<TReturns>) {
  const [data, setData] = useState<TReturns | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<{ code: string; message?: string } | null>(null);
  
  const mutate = useCallback(async (args: TArgs) => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutateFn(args);
      setData(result);
      setLoading(false);
      return result;
    } catch (err) {
      setError({ code: 'MUTATION_ERROR', message: String(err) });
      setLoading(false);
      throw err;
    }
  }, [mutateFn]);
  
  return { mutate, data, loading, error };
}

// Stubs for hook signatures used in component imports
export function useCurrentUser() {
  return {
    user: { id: 'anonymous', email: 'anonymous@example.com' },
    organization: null,
    loading: false,
    error: null
  };
}

export function useUploadFile() {
  return {
    upload: async () => '',
    loading: false,
    error: null
  };
}

export function useMembers() {
  return {
    data: {},
    loading: false,
    error: { code: '' }
  };
}

export function usePresence() {
  return {
    data: [],
    publish: () => {},
    loading: false,
    error: { code: '' }
  };
}

// (Routing hooks useParams/useLocation are provided by react-router-dom.)
