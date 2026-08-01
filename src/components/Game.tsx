import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Volume2, VolumeX, X, Compass, Zap, Plus, BookOpen, Search, Check, Sparkles, Trophy, Flame, SkipForward, ArrowRight,
} from 'lucide-react';
import {
  useMyProgress,
  useDueReviews,
  useMyBookmarks,
  useUpdateProgressMutation,
  useUpsertReviewScheduleMutation,
  useCreateSessionMutation,
  useAwardAchievementMutation,
  useUpdateDailyGoalMutation,
  useSetClozeLevelMutation,
} from '../hooks';
import { getDailyGoal, getBookmarks } from '../storage';
import { KJV_VERSES } from '../data/kjv-verses';
import { getKJVVerse } from '../data/kjv-bible';
import { starterRegions, unlockedRegions, resolveRefsToVerses } from '../game/regions';
import { loadGameState, saveGameState } from '../game/state';
import { setAudioMuted } from '../game/engine/audio';
import type { GameTheme, LampResolveResult, ScaffoldLayer } from '../game';

type Theme = GameTheme;
type SubMode = 'journey' | 'race' | 'road';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

const PRESET_ROADS = [
  {
    name: 'Psalms Path',
    desc: 'Selected Psalms for comfort & worship',
    refs: ['Psalm 1:1', 'Psalm 23:1', 'Psalm 23:4', 'Psalm 46:10', 'Psalm 91:1', 'Psalm 100:1', 'Psalm 119:11', 'Psalm 119:105'],
  },
  {
    name: 'Romans Road',
    desc: 'The plan of salvation in Romans',
    refs: ['Romans 3:23', 'Romans 6:23', 'Romans 8:28', 'Romans 12:2'],
  },
  {
    name: 'Gospel Journey',
    desc: 'Core verses from the Gospels',
    refs: ['Matthew 5:3', 'Matthew 6:33', 'Matthew 11:28', 'Matthew 28:19', 'John 1:1', 'John 3:16', 'John 14:6'],
  },
  {
    name: 'Wisdom Path',
    desc: 'Proverbs and James on godly wisdom',
    refs: ['Proverbs 3:5', 'Proverbs 3:6', 'Proverbs 16:3', 'James 1:5'],
  },
  {
    name: 'Comfort & Faith',
    desc: 'Promises of strength, courage & peace',
    refs: ['Joshua 1:9', 'Isaiah 40:31', 'Philippians 4:13', 'Hebrews 11:1', '1 John 1:9'],
  },
];

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<{
    dispose: () => void;
    setTheme: (t: Theme) => void;
    setStage: (stage: ScaffoldLayer | null) => void;
    skipLamp: () => void;
    swapVerse: () => void;
  } | null>(null);

  const [bootKey, setBootKey] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [soundEnabled, setSoundEnabled] = useState(() => loadGameState().settings.sound);
  const defaultVerse = starterRegions()[0]?.verses[0];
  const [showPeek, setShowPeek] = useState(false);
  const [activeRef, setActiveRef] = useState<string>(() => defaultVerse?.reference ?? '');
  const [activeText, setActiveText] = useState<string>(() => defaultVerse?.text ?? '');
  const [activeStage, setActiveStage] = useState<ScaffoldLayer | null>(null);
  const [stageOverride, setStageOverride] = useState<ScaffoldLayer | null>(null);
  const [activePrompt, setActivePrompt] = useState<string>('');
  const [summary, setSummary] = useState<{ totalXp: number; lampsLit: number; bestCombo: number } | null>(null);

  // Skip-this-lamp affordance. The engine drives `canSkip` (true only after the
  // player has struggled); `showSkipConfirm` is the two-step guard; `autoPeek`
  // distinguishes the skip reveal from a manual Peek so onVerseChange can hide
  // only the auto-opened one.
  const [canSkip, setCanSkip] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [autoPeek, setAutoPeek] = useState(false);

  // Sub-mode state
  const [subMode, setSubMode] = useState<SubMode>('journey');
  const [customRoadPool, setCustomRoadPool] = useState<any[] | null>(null);
  const [showRoadModal, setShowRoadModal] = useState(false);
  const [customRefInput, setCustomRefInput] = useState('');
  const [searchError, setSearchError] = useState('');

  // Lantern Race state
  const [raceSecondsLeft, setRaceSecondsLeft] = useState(60);
  const [raceActive, setRaceActive] = useState(false);

  useEffect(() => {
    setAudioMuted(!soundEnabled);
  }, [soundEnabled]);

  function toggleSound() {
    const state = loadGameState();
    const nextSound = !state.settings.sound;
    state.settings.sound = nextSound;
    saveGameState(state);
    setSoundEnabled(nextSound);
    setAudioMuted(!nextSound);
  }

  // Data & mutation hooks
  const [progress] = useMyProgress();
  const [dueReviews] = useDueReviews();
  const [bookmarks] = useMyBookmarks();
  const { mutate: doUpdateProgress } = useUpdateProgressMutation();
  const { mutate: doUpsertReviewSchedule } = useUpsertReviewScheduleMutation();
  const { mutate: doCreateSession } = useCreateSessionMutation();
  const { mutate: doAwardAchievement } = useAwardAchievementMutation();
  const { mutate: doUpdateDailyGoal } = useUpdateDailyGoalMutation();
  const { mutate: doSetClozeLevel } = useSetClozeLevelMutation();

  const navigate = useNavigate();

  const progressRef = useRef<any[]>(progress ?? []);
  progressRef.current = progress ?? [];
  const dueRef = useRef<any[]>(dueReviews ?? []);
  dueRef.current = dueReviews ?? [];

  const versesPracticedRef = useRef<Set<string>>(new Set());
  const correctCountRef = useRef(0);
  const totalCountRef = useRef(0);

  // 60-second Sprint timer effect for Lantern Race
  useEffect(() => {
    if (subMode !== 'race' || !raceActive || status !== 'ready' || summary) return;
    const timer = setInterval(() => {
      setRaceSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRaceActive(false);
          void doAwardAchievement({ type: 'lantern-race' }).catch(() => {});
          setSummary({
            totalXp: correctCountRef.current * 25,
            lampsLit: correctCountRef.current,
            bestCombo: totalCountRef.current,
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [subMode, raceActive, status, summary, doAwardAchievement]);

  // Boot the engine
  useEffect(() => {
    let cancelled = false;
    const storageHandler = (e: Event) => {
      if ((e as CustomEvent).detail?.key !== 'kjv-theme') return;
      engineRef.current?.setTheme(currentTheme());
    };

    versesPracticedRef.current = new Set();
    correctCountRef.current = 0;
    totalCountRef.current = 0;
    setSummary(null);
    setCanSkip(false);
    setShowSkipConfirm(false);
    setAutoPeek(false);

    (async () => {
      try {
        setStatus('loading');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const masteredCount = (progressRef.current ?? []).filter(
          (p: any) => p?.status === 'mastered',
        ).length;

        let pool: any[] = [];
        if (subMode === 'road' && customRoadPool && customRoadPool.length > 0) {
          pool = customRoadPool;
        } else if (subMode === 'race') {
          // Sprint mode: prefer mastered / high-streak verses for rapid recall
          const base = unlockedRegions(starterRegions(), masteredCount).flatMap((r) => r.verses);
          const masteredSet = new Set(
            (progressRef.current ?? []).filter((p: any) => p?.status === 'mastered').map((p: any) => p?.verse?.reference),
          );
          const masteredInPool = base.filter((v) => masteredSet.has(v.reference));
          pool = masteredInPool.length >= 4 ? masteredInPool : base;
        } else {
          pool = unlockedRegions(starterRegions(), masteredCount).flatMap((r) => r.verses);
          // Auto-merge favorited verses into the Journey pool. Favorites may be
          // outside the curated set or be verse ranges; resolveRefsToVerses
          // expands ranges to one verse per lamp and fetches non-curated verses
          // from the full Bible. Duplicates of verses already in the pool are
          // skipped so a curated favorite isn't added twice.
          const bookmarkRefs = (getBookmarks() ?? []).map((b: any) => b?.reference).filter(Boolean) as string[];
          if (bookmarkRefs.length > 0) {
            const favVerses = await resolveRefsToVerses(bookmarkRefs, KJV_VERSES);
            const seen = new Set(pool.map((v: any) => v.reference));
            for (const v of favVerses) {
              if (!seen.has(v.reference)) {
                pool.push(v);
                seen.add(v.reference);
              }
            }
          }
        }

        if (pool.length > 0) {
          setActiveRef(pool[0].reference);
          setActiveText(pool[0].text);
        }
        const dailyGoalCompleted = !!getDailyGoal()?.completed;

        const { createLampGame } = await import('../game');
        if (cancelled) return;
        const engine = await createLampGame({
          canvas: canvasRef.current as HTMLCanvasElement,
          theme: currentTheme(),
          reducedMotion,
          pool,
          progress: progressRef.current,
          due: dueRef.current,
          dailyGoalCompleted,
          callbacks: {
            onResolve: (result: LampResolveResult) => {
              handleResolve(result, pool);
            },
            onVerseChange: (v: any, stage: ScaffoldLayer, prompt: string) => {
              if (v?.reference && v?.text) {
                setActiveRef(v.reference);
                setActiveText(v.text);
              }
              setActiveStage(stage);
              setActivePrompt(prompt ?? '');
              const entry = progressRef.current.find(
                (p: any) => p?.verse?.reference === v?.reference,
              );
              setStageOverride(entry?.customClozeLevel ?? null);
              // New verse: close any stale skip confirm and hide the auto-reveal
              // (a manually opened Peek is left untouched).
              setShowSkipConfirm(false);
              if (autoPeek) {
                setShowPeek(false);
                setAutoPeek(false);
              }
            },
            onCanSkipChange: (can: boolean) => setCanSkip(can),
            onSessionComplete: (stats) => {
              if (subMode !== 'race') {
                setSummary(stats);
              }
            },
          },
        });
        if (cancelled) {
          engine.dispose();
          return;
        }
        engineRef.current = engine;
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    window.addEventListener('kjv-storage-change', storageHandler);
    return () => {
      cancelled = true;
      window.removeEventListener('kjv-storage-change', storageHandler);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootKey, subMode]);

  function handleResolve(result: LampResolveResult, pool: any[]) {
    const { reference, correct } = result;
    const found = pool.find((v) => v.reference === reference);
    if (found) {
      setActiveRef(found.reference);
      setActiveText(found.text);
    }
    // A skip is recorded as a miss (correct:false flows through the existing
    // progress / review-schedule writes below) but also reveals the verse via
    // the Peek panel so the player sees the answer before advancing.
    if (result.skipped) {
      setShowPeek(true);
      setAutoPeek(true);
    }
    versesPracticedRef.current.add(reference);
    totalCountRef.current += 1;
    if (correct) correctCountRef.current += 1;

    void doUpdateProgress({
      reference,
      correct,
      accuracy: result.accuracy,
    }).catch(() => {});

    const existing = progressRef.current.find(
      (p: any) => p?.verse?.reference === reference,
    );
    const streak = correct ? (existing?.streak ?? 0) + 1 : 0;
    void doUpsertReviewSchedule({
      reference,
      correct,
      streak,
      accuracy: result.accuracy,
    }).catch(() => {});

    // Award game achievements
    if (correct) {
      const masteredCount = (progressRef.current ?? []).filter((p: any) => p?.status === 'mastered').length + (streak >= 5 ? 1 : 0);
      if (masteredCount >= 10) {
        void doAwardAchievement({ type: 'city-on-a-hill' }).catch(() => {});
      }

      // Check for book-complete: all curated verses from a single book mastered
      const bookVerseCounts = new Map<string, { total: number; mastered: number }>();
      for (const v of KJV_VERSES) {
        const existing = bookVerseCounts.get(v.book) || { total: 0, mastered: 0 };
        existing.total += 1;
        const prog = progressRef.current.find((p: any) => p?.verse?.reference === v.reference);
        if (prog?.status === 'mastered' || (v.reference === reference && streak >= 5)) {
          existing.mastered += 1;
        }
        bookVerseCounts.set(v.book, existing);
      }
      for (const [book, counts] of bookVerseCounts.entries()) {
        if (counts.mastered === counts.total && counts.total > 0) {
          void doAwardAchievement({ type: 'book-complete', book: { name: book } }).catch(() => {});
        }
      }

      // Check for testament-complete: all curated verses from OT or NT mastered
      const otBooks = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'];
      const ntBooks = ['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];

      let otTotal = 0, otMastered = 0, ntTotal = 0, ntMastered = 0;
      for (const v of KJV_VERSES) {
        const isOt = otBooks.includes(v.book);
        const isNt = ntBooks.includes(v.book);
        if (isOt) {
          otTotal += 1;
          const prog = progressRef.current.find((p: any) => p?.verse?.reference === v.reference);
          if (prog?.status === 'mastered' || (v.reference === reference && streak >= 5)) {
            otMastered += 1;
          }
        }
        if (isNt) {
          ntTotal += 1;
          const prog = progressRef.current.find((p: any) => p?.verse?.reference === v.reference);
          if (prog?.status === 'mastered' || (v.reference === reference && streak >= 5)) {
            ntMastered += 1;
          }
        }
      }
      if (otMastered === otTotal && otTotal > 0) {
        void doAwardAchievement({ type: 'testament-complete', book: { name: 'Old Testament' } }).catch(() => {});
      }
      if (ntMastered === ntTotal && ntTotal > 0) {
        void doAwardAchievement({ type: 'testament-complete', book: { name: 'New Testament' } }).catch(() => {});
      }
    }
  }

  function handleStageChange(stage: ScaffoldLayer | null) {
    if (!activeRef) return;
    engineRef.current?.setStage(stage);
    setActiveStage(stage ?? computeAutoStage(activeRef));
    setStageOverride(stage);
    void doSetClozeLevel({ reference: activeRef, level: stage }).catch(() => {});
  }

  function computeAutoStage(reference: string): ScaffoldLayer {
    const entry = progressRef.current.find((p: any) => p?.verse?.reference === reference);
    const timesRecited = entry?.timesRecited ?? 0;
    if (entry?.status === 'mastered') return 5;
    if (timesRecited <= 0) return 0;
    if (timesRecited <= 2) return 1;
    if (timesRecited <= 4) return 2;
    if (timesRecited <= 6) return 3;
    if (timesRecited <= 9) return 4;
    return 5;
  }

  function startJourney() {
    setSubMode('journey');
    setRaceActive(false);
    setBootKey((k) => k + 1);
  }

  function startRace() {
    setSubMode('race');
    setRaceSecondsLeft(60);
    setRaceActive(true);
    setBootKey((k) => k + 1);
  }

  async function startCustomRoad(name: string, refs: string[]) {
    // Resolve refs (curated, non-curated, or ranges) into verses via the full
    // Bible so custom roads and the "My Bookmarked Verses" button work for any
    // favorited reference, not just the curated set.
    const verses = await resolveRefsToVerses(refs, KJV_VERSES);
    if (verses.length === 0) return;
    setCustomRoadPool(verses);
    setSubMode('road');
    setShowRoadModal(false);
    setRaceActive(false);
    void doAwardAchievement({ type: 'pathfinder' }).catch(() => {});
    setBootKey((k) => k + 1);
  }

  async function handleAddCustomReference() {
    if (!customRefInput.trim()) return;
    setSearchError('');
    try {
      const entry = await getKJVVerse(customRefInput.trim());
      if (entry) {
        const customVerse = {
          reference: entry.reference,
          book: entry.reference.split(' ')[0],
          chapter: 1,
          verse: entry.verse,
          text: entry.text,
          keywords: [],
          difficulty: 'medium' as const,
          theme: 'custom',
        };
        startCustomRoad(entry.reference, [entry.reference]);
        setCustomRefInput('');
      } else {
        setSearchError('Verse reference not found in KJV Bible.');
      }
    } catch {
      setSearchError('Could not load verse.');
    }
  }

  function playAgain() {
    if (subMode === 'race') {
      startRace();
    } else {
      setSummary(null);
      setBootKey((k) => k + 1);
    }
  }

  async function handleExit() {
    const verses = [...versesPracticedRef.current];
    const total = totalCountRef.current;
    const correct = correctCountRef.current;

    await doCreateSession({
      versesPracticed: verses,
      mode: 'game',
      score: total > 0 ? Math.round((correct / total) * 100) : 0,
      totalQuestions: total,
    }).catch(() => {});

    const baseToday = getDailyGoal()?.completedVerses ?? 0;
    await doUpdateDailyGoal({ completedVerses: baseToday + correct }).catch(() => {});

    if (correct > 0) await doAwardAchievement({ type: 'first-verse' }).catch(() => {});
    const masteredCount = (progressRef.current ?? []).filter((p: any) => p?.status === 'mastered').length;
    if (masteredCount >= 1) await doAwardAchievement({ type: 'master-level' }).catch(() => {});
    if (masteredCount >= 15) await doAwardAchievement({ type: 'book-complete' }).catch(() => {});
    if (masteredCount >= 41) await doAwardAchievement({ type: 'testament-complete' }).catch(() => {});

    navigate('/practice');
  }

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-dvh block touch-none" />

      {/* Top controls are hidden in the error state so the error overlay's own
          Exit button is the only `aria-label="Exit"` on screen. Without this,
          the always-rendered Controls HUD Exit and the error overlay Exit
          share the same accessible name and both match
          `button[aria-label="Exit"]`, breaking strict-mode locators (and
          confusing screen readers). */}
      {status !== 'error' && (
        <>
      {/* Top Left: Sub-mode Selector chips */}
      <div className="absolute top-2 left-2 sm:left-4 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={startJourney}
          title="Journey Mode — Walk the path and light lamps at your own pace"
          className={`glassmorphism rounded-full p-1.5 sm:px-3 sm:py-1 text-xs font-bold transition-all flex items-center gap-1 ${
            subMode === 'journey' ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-700 dark:text-gray-200 hover:bg-white/20'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Journey</span>
        </button>

        <button
          type="button"
          onClick={startRace}
          title="Lantern Race — 60-second timed sprint recall"
          className={`glassmorphism rounded-full p-1.5 sm:px-3 sm:py-1 text-xs font-bold transition-all flex items-center gap-1 ${
            subMode === 'race' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-700 dark:text-gray-200 hover:bg-white/20'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-yellow-300" />
          <span className="hidden sm:inline">Race</span>
          {subMode === 'race' && raceActive && (
            <span className="text-[10px] font-extrabold bg-black/30 rounded-full px-1 py-0.2">
              {raceSecondsLeft}s
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowRoadModal(true)}
          title="Build a Road — Create a custom branch road for any passage"
          className={`glassmorphism rounded-full p-1.5 sm:px-3 sm:py-1 text-xs font-bold transition-all flex items-center gap-1 ${
            subMode === 'road' ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-700 dark:text-gray-200 hover:bg-white/20'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Road</span>
        </button>
      </div>

      {/* Top Right: Controls HUD */}
      <div className="absolute top-2 right-2 sm:right-4 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={() => { setShowPeek((prev) => !prev); setAutoPeek(false); }}
          aria-label={showPeek ? 'Hide verse text' : 'Peek verse text'}
          title={showPeek ? 'Hide full verse text' : 'Peek full verse text'}
          className="glassmorphism rounded-full p-1.5 sm:px-3 sm:py-1 shadow-lg hover:bg-white/20 transition-colors flex items-center gap-1"
        >
          {showPeek ? (
            <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
          ) : (
            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
          )}
          <span className="hidden sm:inline text-xs font-semibold text-gray-700 dark:text-gray-200">
            {showPeek ? 'Hide' : 'Peek'}
          </span>
        </button>
        {canSkip && (
          <button
            type="button"
            onClick={() => setShowSkipConfirm(true)}
            aria-label="Skip this lamp"
            title="Skip this lamp — counts as a miss"
            className="glassmorphism rounded-full p-1.5 sm:px-3 sm:py-1 shadow-lg hover:bg-white/20 transition-colors flex items-center gap-1 border border-amber-400/40"
          >
            <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            <span className="hidden sm:inline text-xs font-semibold text-gray-700 dark:text-gray-200">
              Skip
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          title={soundEnabled ? 'Sound is on — click to mute' : 'Sound is muted — click to enable'}
          className="glassmorphism rounded-full p-1.5 shadow-lg hover:bg-white/20 transition-colors"
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>
        <button
          type="button"
          onClick={handleExit}
          aria-label="Exit"
          title="Exit game"
          className="glassmorphism rounded-full p-1.5 shadow-lg hover:bg-white/20 transition-colors"
        >
          <X className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-200" />
        </button>
      </div>
        </>
      )}

      {/* Skip-and-swap verse: a circular right-arrow button on the right edge,
          vertically centered. Swaps the current verse for a different random
          one from the queue without advancing the lamp — the skipped verse is
          moved to the end of the queue and deferred so it isn't immediately
          re-chosen. (A right-to-left swipe on the canvas does the same.) */}
      {status === 'ready' && !summary && (
        <button
          type="button"
          onClick={() => engineRef.current?.swapVerse()}
          aria-label="Skip to a different verse"
          title="Skip to a different verse — stays on this lamp"
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 glassmorphism rounded-full p-2 sm:p-2.5 shadow-lg hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center border border-white/15"
        >
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400" />
        </button>
      )}

      {showPeek && activeText && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 max-w-lg w-11/12 glassmorphism rounded-2xl p-4 shadow-2xl border border-purple-500/30 text-center animate-fadeIn">
          <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
            {activeRef}
          </p>
          <p className="text-sm font-serif leading-relaxed text-gray-800 dark:text-gray-100">
            {activeText}
          </p>
        </div>
      )}

      {/* Skip-this-lamp confirmation (two-step guard; "Keep trying" is primary) */}
      {showSkipConfirm && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn p-4">
          <div className="glassmorphism rounded-2xl p-5 sm:p-6 shadow-2xl border border-amber-500/30 max-w-xs w-full text-center">
            <p className="text-sm font-bold text-amber-500 dark:text-amber-400 mb-1">
              Skip this lamp?
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
              It counts as a miss. You&apos;ll see the verse, then move on.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setShowSkipConfirm(false)}
                className="rounded-full px-4 py-1.5 text-xs font-bold bg-amber-500 text-white shadow hover:bg-amber-600 transition-colors"
              >
                Keep trying
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSkipConfirm(false);
                  engineRef.current?.skipLamp();
                }}
                className="rounded-full px-4 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 glassmorphism border border-white/20 hover:bg-white/20 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage instruction + stage-control chips */}
      {status === 'ready' && !summary && !showPeek && activePrompt && (
        <div className="absolute top-[42px] sm:top-[50px] left-1/2 -translate-x-1/2 z-10 flex flex-col items-center justify-center gap-0.5 max-w-[96vw] px-1">
          <span className="text-[11px] sm:text-xs font-bold text-amber-500 dark:text-amber-400 text-center drop-shadow-sm">
            {activePrompt}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 glassmorphism rounded-full px-2 py-0.5 shadow-md border border-white/10">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400 mr-0.5">
              Stage
            </span>
            {([0, 1, 2, 3, 4, 5] as ScaffoldLayer[]).map((s) => {
              const isActive = stageOverride === s || (stageOverride === null && activeStage === s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStageChange(s)}
                  title={`Stage ${s}`}
                  className={`min-w-[1.15rem] sm:min-w-[1.35rem] rounded-full px-1 py-0.2 text-[10px] sm:text-xs font-extrabold transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {s}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleStageChange(null)}
              title="Auto — let the stage advance with recitation count"
              className={`rounded-full px-1.5 py-0.2 text-[10px] sm:text-xs font-extrabold transition-colors ${
                stageOverride === null
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white/20'
              }`}
            >
              Auto
            </button>
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="glassmorphism rounded-2xl px-6 py-4 flex items-center gap-3 shadow-xl">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <span className="text-gray-700 dark:text-gray-100">Lighting the lamps…</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-sm">
          <p className="glassmorphism rounded-2xl px-6 py-3 text-red-600 dark:text-red-300 shadow-xl">
            Could not start the game.
          </p>
          <button
            type="button"
            onClick={handleExit}
            className="glassmorphism rounded-full p-2 shadow-lg hover:bg-white/20 transition-colors"
            aria-label="Exit"
          >
            <X className="w-6 h-6 text-gray-700 dark:text-gray-100" />
          </button>
        </div>
      )}

      {/* Build a Road Modal */}
      {showRoadModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn p-4">
          <div className="glassmorphism rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-500/30 max-w-lg w-full max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Compass className="w-6 h-6 text-amber-500" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Build a Road</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRoadModal(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-5">
              Pick a scripture passage to construct a custom branch road and light its lamps step-by-step:
            </p>

            {/* Presets */}
            <div className="space-y-2 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Preset Scripture Paths
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_ROADS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => startCustomRoad(preset.name, preset.refs)}
                    className="glassmorphism p-3 rounded-xl text-left hover:border-amber-400 transition-all group border border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-200 group-hover:text-amber-500">
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {preset.refs.length} v
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {preset.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bookmarks */}
            {bookmarks && bookmarks.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  My Bookmarked Verses
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    startCustomRoad(
                      'Bookmarked Road',
                      bookmarks.map((b: any) => b.reference),
                    )
                  }
                  className="w-full glassmorphism p-3 rounded-xl flex items-center justify-between text-left hover:border-indigo-400 transition-all border border-indigo-500/20"
                >
                  <div>
                    <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      My Bookmarked Verses
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Light lamps for all {bookmarks.length} bookmarked verses
                    </p>
                  </div>
                  <Check className="w-5 h-5 text-indigo-500" />
                </button>
              </div>
            )}

            {/* Custom Search/Reference Lookup */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Custom Verse Lookup
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Psalm 121:1"
                  value={customRefInput}
                  onChange={(e) => setCustomRefInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomReference()}
                  className="flex-1 bg-white/10 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomReference}
                  className="btn-primary px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow hover:bg-indigo-500 flex items-center gap-1"
                >
                  <Search className="w-4 h-4" />
                  <span>Build</span>
                </button>
              </div>
              {searchError && (
                <p className="text-xs text-red-500 mt-1.5">{searchError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session summary */}
      {summary && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="glassmorphism rounded-3xl px-6 py-7 sm:px-10 sm:py-9 flex flex-col items-center gap-5 shadow-2xl border border-amber-500/30 max-w-sm w-11/12 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500 dark:text-amber-400">
              {subMode === 'race' ? '⚡ Sprint Complete' : 'Journey Complete'}
            </p>
            <p className="text-3xl sm:text-4xl font-extrabold text-gray-800 dark:text-gray-100">
              ✨ {summary.lampsLit} Lamps Lit
            </p>
            <div className="flex items-center gap-6 sm:gap-8 text-gray-700 dark:text-gray-200">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-amber-500 dark:text-amber-400">
                  {summary.totalXp}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  XP earned
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-rose-500 dark:text-rose-400">
                  🔥 {summary.bestCombo}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Best combo
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">
                  {totalCountRef.current > 0
                    ? Math.round((correctCountRef.current / totalCountRef.current) * 100)
                    : 0}
                  %
                </span>
                <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Accuracy
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={playAgain}
                className="rounded-full px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg hover:from-amber-400 hover:to-orange-400 transition-colors"
              >
                {subMode === 'race' ? 'Race Again' : 'Play Again'}
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="glassmorphism rounded-full px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-white/20 transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
