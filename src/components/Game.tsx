// React host for "Lamp of the Path" (task C-1).
//
// The host owns the React chrome (full-viewport canvas, exit button, loading
// and error states, theme sync) and wires the engine's `onResolve` callback to
// the existing progress / review / session / daily-goal mutations — mirroring
// `Practice.tsx` `handleComplete`. ALL game logic lives in the pure modules
// under `src/game/`; this file contains no game decisions. The Babylon engine
// is loaded via a dynamic `import('../game')` so it is code-split away from
// the site's first paint.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, X } from 'lucide-react';
import {
  useMyProgress,
  useDueReviews,
  useUpdateProgressMutation,
  useUpsertReviewScheduleMutation,
  useCreateSessionMutation,
  useAwardAchievementMutation,
  useUpdateDailyGoalMutation,
} from '../hooks';
import { getDailyGoal } from '../storage';
import { starterRegions, unlockedRegions } from '../game/regions';
import { loadGameState, saveGameState } from '../game/state';
import { setAudioMuted } from '../game/engine/audio';
import type { GameTheme, LampResolveResult } from '../game';

type Theme = GameTheme;

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<{ dispose: () => void; setTheme: (t: Theme) => void } | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [soundEnabled, setSoundEnabled] = useState(() => loadGameState().settings.sound);

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

  // Existing data + mutation hooks (same set Practice.tsx uses).
  const [progress] = useMyProgress();
  const [dueReviews] = useDueReviews();
  const { mutate: doUpdateProgress } = useUpdateProgressMutation();
  const { mutate: doUpsertReviewSchedule } = useUpsertReviewScheduleMutation();
  const { mutate: doCreateSession } = useCreateSessionMutation();
  const { mutate: doAwardAchievement } = useAwardAchievementMutation();
  const { mutate: doUpdateDailyGoal } = useUpdateDailyGoalMutation();

  const navigate = useNavigate();

  // --- Refs that hold the latest data so callbacks never read a stale closure -
  const progressRef = useRef<any[]>(progress ?? []);
  progressRef.current = progress ?? [];

  // Session accumulators (mutated inside onResolve / Exit, not via state).
  const versesPracticedRef = useRef<Set<string>>(new Set());
  const correctCountRef = useRef(0);
  const totalCountRef = useRef(0);

  // --- Boot the engine once on mount ----------------------------------------
  useEffect(() => {
    let cancelled = false;
    const storageHandler = (e: Event) => {
      if ((e as CustomEvent).detail?.key !== 'kjv-theme') return;
      engineRef.current?.setTheme(currentTheme());
    };

    (async () => {
      try {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const masteredCount = (progressRef.current ?? []).filter(
          (p: any) => p?.status === 'mastered',
        ).length;
        const pool = unlockedRegions(starterRegions(), masteredCount).flatMap((r) => r.verses);
        const dailyGoalCompleted = !!getDailyGoal()?.completed;

        const { createLampGame } = await import('../game');
        if (cancelled) return;
        const engine = await createLampGame({
          canvas: canvasRef.current as HTMLCanvasElement,
          theme: currentTheme(),
          reducedMotion,
          pool,
          progress: progressRef.current,
          due: dueReviews ?? [],
          dailyGoalCompleted,
          callbacks: {
            onResolve: (result: LampResolveResult) => {
              handleResolve(result);
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
  }, []);

  // --- onResolve: mirror Practice.tsx handleComplete (per-verse writes) ------
  function handleResolve(result: LampResolveResult) {
    const { reference, correct } = result;
    // Accumulate session stats.
    versesPracticedRef.current.add(reference);
    totalCountRef.current += 1;
    if (correct) correctCountRef.current += 1;

    // Per-verse progress + review schedule (mirror handleComplete).
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
  }

  // --- Exit: finalize session, then navigate to /practice --------------------
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

    // Daily goal: ADD to today's base (mirror handleComplete).
    const baseToday = getDailyGoal()?.completedVerses ?? 0;
    await doUpdateDailyGoal({ completedVerses: baseToday + correct }).catch(() => {});

    // Achievements (mirror handleComplete).
    if (correct > 0) await doAwardAchievement({ type: 'first-verse' }).catch(() => {});
    const masteredCount = (progressRef.current ?? []).filter(
      (p: any) => p?.status === 'mastered',
    ).length;
    if (masteredCount >= 1) await doAwardAchievement({ type: 'master-level' }).catch(() => {});
    if (masteredCount >= 15) await doAwardAchievement({ type: 'book-complete' }).catch(() => {});
    if (masteredCount >= 41) await doAwardAchievement({ type: 'testament-complete' }).catch(() => {});

    navigate('/practice');
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-screen block touch-none" />

      {/* Slim overlay HUD */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          title={soundEnabled ? 'Sound is on — click to mute' : 'Sound is muted — click to enable'}
          className="glassmorphism rounded-full p-2 shadow-lg hover:bg-white/20 transition-colors"
        >
          {soundEnabled ? (
            <Volume2 className="w-6 h-6 text-amber-500 dark:text-amber-400" />
          ) : (
            <VolumeX className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          )}
        </button>
        <button
          type="button"
          onClick={handleExit}
          aria-label="Exit"
          className="glassmorphism rounded-full p-2 shadow-lg hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6 text-gray-700 dark:text-gray-100" />
        </button>
      </div>

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
    </div>
  );
}