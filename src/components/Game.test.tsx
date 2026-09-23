import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// --- Mocks -------------------------------------------------------------

// Capture the options passed to createLampGame and let tests fire onResolve.
let lastEngineOpts: any = null;
const engineDispose = vi.fn();
const engineSetTheme = vi.fn();
const engineSetStage = vi.fn();
const engineSkipLamp = vi.fn();
const engineSwapVerse = vi.fn();
const engineSetTopInset = vi.fn();

vi.mock('../game', () => ({
  createLampGame: vi.fn(async (opts: any) => {
    lastEngineOpts = opts;
    return {
      dispose: engineDispose,
      setTheme: engineSetTheme,
      setStage: engineSetStage,
      // The host measures its own chrome and reports the band to the engine
      // (see the measuring effect in Game.tsx); the real engine re-lays-out from
      // it. Part of the interface, so the fake carries it too.
      setTopInset: engineSetTopInset,
      // Skip-and-swap: no-op in the mock (the real engine swaps the verse
      // without firing onResolve or advancing the lamp).
      swapVerse: engineSwapVerse,
      // Mirror the real engine: skipLamp records a miss by firing onResolve
      // with correct:false + skipped:true, so the host writes a miss.
      skipLamp: () => {
        engineSkipLamp();
        opts.callbacks.onResolve({
          reference: 'John 3:16',
          correct: false,
          accuracy: 0,
          rating: 'needs-work',
          fluent: false,
          usedHint: true,
          earnedXp: 0,
          skipped: true,
        });
      },
    };
  }),
}));

// Spy on the mutators the host wires to onResolve / Exit.
const doUpdateProgress = vi.fn().mockResolvedValue(undefined);
const doUpsertReviewSchedule = vi.fn().mockResolvedValue(undefined);
const doCreateSession = vi.fn().mockResolvedValue(undefined);
const doAwardAchievement = vi.fn().mockResolvedValue(undefined);
const doUpdateDailyGoal = vi.fn().mockResolvedValue(undefined);
const doSetClozeLevel = vi.fn().mockResolvedValue(undefined);

let mockProgress: any[] = [];

vi.mock('../hooks', () => ({
  useMyProgress: () => [mockProgress, false, null],
  useDueReviews: () => [[], false, null],
  useMyBookmarks: () => [[], false, null],
  useUpdateProgressMutation: () => ({ mutate: doUpdateProgress }),
  useUpsertReviewScheduleMutation: () => ({ mutate: doUpsertReviewSchedule }),
  useCreateSessionMutation: () => ({ mutate: doCreateSession }),
  useAwardAchievementMutation: () => ({ mutate: doAwardAchievement }),
  useUpdateDailyGoalMutation: () => ({ mutate: doUpdateDailyGoal }),
  useSetClozeLevelMutation: () => ({ mutate: doSetClozeLevel }),
}));

// useNavigate spy
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual: any = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

// matchMedia mock (overridable per-test)
let matchMediaMatches = false;
beforeEach(() => {
  matchMediaMatches = false;
  (window as any).matchMedia = vi.fn().mockImplementation(() => ({
    matches: matchMediaMatches,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

import Game from './Game';
import { createLampGame } from '../game';

// --- Helpers -----------------------------------------------------------

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/practice/game']}>
      <Routes>
        <Route path="/practice/game" element={<Game />} />
        <Route path="/practice" element={<div data-testid="practice" />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Flush microtasks / pending effects so createLampGame resolves. */
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// --- Tests -------------------------------------------------------------

describe('Game host component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProgress = [];
    lastEngineOpts = null;
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('kjv-theme');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('kjv-theme');
  });

  it('renders a full-viewport canvas', async () => {
    const { unmount } = renderGame();
    const canvas = document.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.className).toContain('w-full');
    expect(canvas?.className).toContain('h-dvh');
    await flush();
    unmount();
  });

  it('measures the DOM chrome and reports the band to the engine', async () => {
    // The host's half of the verse-readability contract: the engine cannot see
    // the DOM, so this measurement is the only source of the band the canvas has
    // to stay below. (The e2e layout spec checks the other end of that wire, on a
    // real browser.) jsdom reports every rect as zero, so the geometry is stubbed
    // to what a phone renders.
    const { unmount } = renderGame();
    await flush();

    // The prompt column mounts only once the engine reports the verse's prompt.
    const showPrompt = (prompt: string) =>
      act(() => {
        lastEngineOpts.callbacks.onVerseChange(
          { reference: 'John 3:16', text: 'For God so loved the world' },
          0,
          prompt,
        );
      });
    showPrompt('Tap the words in the right order');
    await flush();

    const chrome = Array.from(document.querySelectorAll('[data-game-chrome]'));
    expect(chrome.length).toBeGreaterThan(0);

    // The chips row and the controls HUD share the top bar; the prompt column
    // hangs below both and, wrapping to a second line, reaches further down than
    // either. That is the case the old hardcoded 88 px guess got wrong.
    const bottoms: Record<string, number> = { chips: 40, controls: 40, prompt: 132 };
    for (const el of chrome) {
      const bottom = bottoms[el.getAttribute('data-game-chrome') ?? ''] ?? 40;
      el.getBoundingClientRect = () =>
        ({
          top: bottom - 30,
          bottom,
          height: 30,
          left: 0,
          right: 100,
          width: 100,
          x: 0,
          y: bottom - 30,
          toJSON: () => ({}),
        }) as DOMRect;
    }

    // Re-report through the path that is available here: a changed prompt re-runs
    // the measuring effect (jsdom has no ResizeObserver, so the effect falls back
    // to a window resize listener — and this also pins that fallback).
    showPrompt('A longer prompt that wraps');
    await flush();

    expect(engineSetTopInset).toHaveBeenCalled();
    // The lowest edge wins — not the first element measured, not the last.
    expect(engineSetTopInset).toHaveBeenLastCalledWith(132);
    unmount();
  });

  it('renders the level/XP/combo line the engine reports, instead of drawing it', async () => {
    // This line used to be canvas text with no plate. It is DOM now, so the host
    // must actually render what the engine pushes — an unhandled `onStatsChange`
    // would silently drop the player's level and XP off the screen.
    const { unmount } = renderGame();
    await flush();

    act(() => {
      lastEngineOpts.callbacks.onVerseChange(
        { reference: 'John 3:16', text: 'For God so loved the world' },
        0,
        'Tap the words in the right order',
      );
      lastEngineOpts.callbacks.onStatsChange({ level: 3, xp: 420, combo: 7 });
    });
    await flush();

    expect(screen.getByText(/Level 3 · 420 XP · Combos x7/)).toBeDefined();
    // The verse it belongs to is rendered in the same column.
    expect(screen.getByText('John 3:16')).toBeDefined();
    unmount();
  });

  it('shows a loading state, then resolves', async () => {
    const { unmount } = renderGame();
    // Loading indicator visible before the engine promise resolves.
    expect(screen.getByText(/Lighting the lamps/i)).toBeDefined();
    await flush();
    // After resolution, the loading indicator is gone.
    expect(screen.queryByText(/Lighting the lamps/i)).toBeNull();
    unmount();
  });

  it('passes the current theme to the engine (dark)', async () => {
    localStorage.setItem('kjv-theme', 'dark');
    document.documentElement.classList.add('dark');
    const { unmount } = renderGame();
    await flush();
    expect(lastEngineOpts).not.toBeNull();
    expect(lastEngineOpts.theme).toBe('dark');
    unmount();
  });

  it('passes the current theme to the engine (light)', async () => {
    const { unmount } = renderGame();
    await flush();
    expect(lastEngineOpts).not.toBeNull();
    expect(lastEngineOpts.theme).toBe('light');
    unmount();
  });

  it('passes the reduced-motion flag', async () => {
    matchMediaMatches = true;
    const { unmount } = renderGame();
    await flush();
    expect(lastEngineOpts).not.toBeNull();
    expect(lastEngineOpts.reducedMotion).toBe(true);
    unmount();
  });

  it('Exit button navigates to /practice', async () => {
    const { unmount } = renderGame();
    await flush();
    const exitBtn = screen.getByRole('button', { name: /exit/i });
    await act(async () => {
      fireEvent.click(exitBtn);
    });
    await flush();
    expect(navigateSpy).toHaveBeenCalledWith('/practice');
    unmount();
  });

  it('error state renders exactly one Exit button (no duplicate)', async () => {
    // When the engine fails to boot, the host sets status='error' and shows an
    // error overlay with its own Exit button. The always-rendered top-controls
    // HUD also has an Exit button — if both render, two buttons share the same
    // accessible name ("Exit") and strict-mode locators break. The HUD is
    // hidden in the error state, so there must be exactly one Exit.
    vi.mocked(createLampGame).mockRejectedValueOnce(new Error('boom'));
    const { unmount } = renderGame();
    await flush();
    expect(screen.getByText(/Could not start the game/i)).toBeDefined();
    const exitBtns = screen.queryAllByRole('button', { name: /^exit$/i });
    expect(exitBtns.length).toBe(1);
    // And that single Exit still navigates home.
    await act(async () => {
      fireEvent.click(exitBtns[0]);
    });
    await flush();
    expect(navigateSpy).toHaveBeenCalledWith('/practice');
    unmount();
  });

  it('disposes the engine on unmount', async () => {
    const { unmount } = renderGame();
    await flush();
    expect(engineDispose).not.toHaveBeenCalled();
    unmount();
    expect(engineDispose).toHaveBeenCalledTimes(1);
  });

  it('onResolve writes progress and review schedule', async () => {
    const { unmount } = renderGame();
    await flush();
    expect(lastEngineOpts).not.toBeNull();
    await act(async () => {
      lastEngineOpts.callbacks.onResolve({
        reference: 'John 3:16',
        correct: true,
        accuracy: 100,
        rating: 'excellent',
        fluent: true,
        usedHint: false,
      });
    });
    expect(doUpdateProgress).toHaveBeenCalledWith({
      reference: 'John 3:16',
      correct: true,
      accuracy: 100,
    });
    expect(doUpsertReviewSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'John 3:16', correct: true, streak: 1 }),
    );
    unmount();
  });

  it('syncs theme to the engine on kjv-storage-change', async () => {
    const { unmount } = renderGame();
    await flush();
    engineSetTheme.mockClear();
    document.documentElement.classList.add('dark');
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('kjv-storage-change', { detail: { key: 'kjv-theme' } }),
      );
    });
    expect(engineSetTheme).toHaveBeenCalledWith('dark');
    unmount();
  });

  it('Skip flow: canSkip -> confirm -> skipLamp records a miss', async () => {
    const { unmount } = renderGame();
    await flush();
    expect(lastEngineOpts).not.toBeNull();

    // Before the engine signals struggle, the Skip control is absent — this
    // is the core accident-prevention guarantee.
    expect(screen.queryByRole('button', { name: /skip this lamp/i })).toBeNull();

    // Engine reports enough wrong submissions to offer Skip.
    await act(async () => {
      lastEngineOpts.callbacks.onCanSkipChange(true);
    });
    const skipBtn = screen.getByRole('button', { name: /skip this lamp/i });
    await act(async () => {
      fireEvent.click(skipBtn);
    });

    // Two-step guard: a confirm modal appears ("Keep trying" is primary).
    expect(screen.getByText(/skip this lamp\?/i)).toBeDefined();
    const confirmSkip = screen.getByRole('button', { name: /^skip$/i });
    await act(async () => {
      fireEvent.click(confirmSkip);
    });

    // skipLamp ran and recorded the verse as a miss (correct:false).
    expect(engineSkipLamp).toHaveBeenCalledTimes(1);
    expect(doUpdateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'John 3:16', correct: false }),
    );
    // No achievement is awarded for a skip (host guards awards on `correct`).
    expect(doAwardAchievement).not.toHaveBeenCalled();
    unmount();
  });

  it('onCanSkipChange(false) hides the Skip control', async () => {
    const { unmount } = renderGame();
    await flush();
    await act(async () => {
      lastEngineOpts.callbacks.onCanSkipChange(true);
    });
    expect(screen.getByRole('button', { name: /skip this lamp/i })).toBeDefined();
    await act(async () => {
      lastEngineOpts.callbacks.onCanSkipChange(false);
    });
    expect(screen.queryByRole('button', { name: /skip this lamp/i })).toBeNull();
    unmount();
  });

  it('advances stageOverride and persists level when transitioning from stage 0 read-along to stage >= 1', async () => {
    mockProgress = [
      {
        verse: { reference: 'Deuteronomy 32:9' },
        timesRecited: 0,
        customClozeLevel: 0,
      },
    ];
    const { unmount } = renderGame();
    await flush();

    act(() => {
      lastEngineOpts.callbacks.onVerseChange(
        { reference: 'Deuteronomy 32:9', text: "For the LORD's portion is his people" },
        0,
        'Verse Stage 0 — Read the verse, then tap to continue',
      );
    });
    await flush();

    act(() => {
      lastEngineOpts.callbacks.onVerseChange(
        { reference: 'Deuteronomy 32:9', text: "For the LORD's portion is his people" },
        1,
        'Verse Stage 1 — Tap the words in order',
      );
    });
    await flush();

    expect(doSetClozeLevel).toHaveBeenCalledWith({
      reference: 'Deuteronomy 32:9',
      level: 1,
    });
    const stage1Btn = screen.getByTitle('Stage 1');
    expect(stage1Btn.className).toContain('bg-amber-500');
    unmount();
  });
});
