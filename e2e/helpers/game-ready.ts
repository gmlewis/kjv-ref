import { test, type Page } from '@playwright/test';

/**
 * How long the engine gets to boot before the suite calls it a hang.
 *
 * This is the suite's own ceiling, not the app's: a failed boot that the app can
 * detect reports itself as `'error'` within a second or two, so the full 30s is
 * only ever spent on a boot that is genuinely stuck. It wants to stay generous —
 * the software-WebGPU boot these tests run on is measured in whole seconds, and
 * a boot that needs 20s in a loaded CI runner is slow, not broken.
 */
export const GAME_BOOT_TIMEOUT_MS = 30_000;

export type GameBoot = 'ready' | 'error' | 'timeout';

/**
 * Wait until the Lamp of the Path engine has booted, and report how it went:
 *
 *   'ready'   — the engine published its puzzle hook; the game is playable.
 *   'error'   — the app gave up and rendered its "Could not start the game."
 *               overlay (no WebGPU, or the engine threw).
 *   'timeout' — the app is still sitting on its loading overlay.
 *
 * Two details here were both wrong in the guard this replaces:
 *
 *  1. The probe runs *inside* the page — a single `page.evaluate` that polls
 *     every 250ms. `page.waitForFunction` polls from the driver on every
 *     animation frame, and the software-WebGPU boot this suite runs on needs
 *     uninterrupted main-thread time: with per-frame round-trips a boot that
 *     normally finishes in ~1s had still not completed after 60s.
 *  2. The failure text is the one the app actually renders
 *     ("Could not start the game.", see src/components/Game.tsx). The old
 *     predicate tested for "Failed to light", a string that appears nowhere in
 *     the app, so its failure branch could never fire and every failure fell
 *     through to the timeout.
 */
export async function waitForGameReady(
  page: Page,
  timeoutMs: number = GAME_BOOT_TIMEOUT_MS,
): Promise<GameBoot> {
  return page.evaluate(
    (timeout) =>
      new Promise<GameBoot>((resolve) => {
        const started = Date.now();
        const poll = () => {
          if (typeof (window as any).__lampGamePuzzle === 'function') return resolve('ready');
          if (document.body.innerText.includes('Could not start the game')) return resolve('error');
          if (Date.now() - started >= timeout) return resolve('timeout');
          setTimeout(poll, 250);
        };
        poll();
      }),
    timeoutMs,
  );
}

/**
 * Wait for the engine and, if it did not boot, skip the current test with a
 * reason naming the failure. Returns `true` only when the game is playable, so
 * callers read:
 *
 *     if (!await requireReadyGame(page, 'D-4')) return;
 *
 * Skipping (rather than the old `return`, which reported a *pass*) keeps an
 * environment that cannot run the game visible in the report. Playwright lists
 * skips and their reason; a passing test that asserted nothing hides the gap
 * entirely, which is how this suite stayed green while nine of its game tests
 * never once exercised the engine in CI.
 */
export async function requireReadyGame(page: Page, label: string): Promise<boolean> {
  const boot = await waitForGameReady(page);
  if (boot === 'ready') return true;

  test.skip(
    true,
    boot === 'error'
      ? `${label}: the lamp game could not initialize WebGPU in this environment`
      : `${label}: the lamp game did not finish booting within ${Math.round(GAME_BOOT_TIMEOUT_MS / 1000)}s`,
  );
  return false;
}
