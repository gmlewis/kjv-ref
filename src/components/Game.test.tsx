import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// --- Mocks -------------------------------------------------------------

// Capture the options passed to createLampGame and let tests fire onResolve.
let lastEngineOpts: any = null;
const engineDispose = vi.fn();
const engineSetTheme = vi.fn();
const engineSetStage = vi.fn();

vi.mock('../game', () => ({
  createLampGame: vi.fn(async (opts: any) => {
    lastEngineOpts = opts;
    return { dispose: engineDispose, setTheme: engineSetTheme, setStage: engineSetStage };
  }),
}));

// Spy on the mutators the host wires to onResolve / Exit.
const doUpdateProgress = vi.fn().mockResolvedValue(undefined);
const doUpsertReviewSchedule = vi.fn().mockResolvedValue(undefined);
const doCreateSession = vi.fn().mockResolvedValue(undefined);
const doAwardAchievement = vi.fn().mockResolvedValue(undefined);
const doUpdateDailyGoal = vi.fn().mockResolvedValue(undefined);
const doSetClozeLevel = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks', () => ({
  useMyProgress: () => [[], false, null],
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
});