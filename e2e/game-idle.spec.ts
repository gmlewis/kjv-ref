import { test, expect, type Page } from '@playwright/test';
import { requireReadyGame } from './helpers/game-ready';

/**
 * The idling contract: a scene that is not moving must not be rendered.
 *
 * The scene renders at the phone's native pixel density (1080x2403 on a Pixel 10
 * XL), and `@babylonjs/lite`'s loop has no dirty check — `startEngine` re-arms
 * itself every frame whether or not anything changed — so the pixels are only
 * saved by actually stopping the engine. The arithmetic that decides when to do
 * that is pure and unit tested (`src/game/engine/idle.ts`, `idle.test.ts`); this
 * spec is what proves the engine honours it, because a predicate that is never
 * called is a comment.
 *
 * Two conditions are asserted, and they are asserted against each other:
 *
 *  1. Normally, the loop keeps the ambient pulse alive for `AMBIENT_IDLE_MS` (5s)
 *     after the player's last touch, then stops — so the reported quiet time at
 *     the moment it stops is at least 5s.
 *  2. Under `prefers-reduced-motion` the pulse never runs at all, so the same
 *     scene stops after the wake window instead. The quiet time is then an order
 *     of magnitude smaller, which is what makes this a real check: a run that
 *     simply never stops fails both, and a run that always stops immediately
 *     fails the first.
 *
 * ## Why it cannot capture anything
 *
 * Same environmental reason as the other engine specs: headless Chrome's default
 * (Metal) WebGPU backend boots the engine but composites nothing, and the software
 * backend that yields real pixels hangs under load, which is exactly what
 * `requireReadyGame` skips. State-only reads keep this spec meaningful in the
 * environment that can run it at all.
 */

/**
 * The engine's policy constants, restated rather than imported so the assertions
 * below read as values a person can check against `src/game/engine/idle.ts` —
 * which is where they must be kept in step if they ever change. The spec runs
 * against the built bundle, so an import would keep them in step automatically
 * only by testing the constant against itself.
 */
const AMBIENT_IDLE_MS = 5000;
const WAKE_MS = 150;

interface RenderingState {
  rendering: boolean;
  looping: boolean;
  hidden: boolean;
  reducedMotion: boolean;
  ambientSprites: number;
  particles: number;
  quietMs: number;
}

/** One sample of `window.__lampGameRendering`. */
function readRendering(page: Page): Promise<RenderingState | null> {
  return page.evaluate(() => {
    const hook = (window as any).__lampGameRendering;
    return typeof hook === 'function' ? (hook() as RenderingState) : null;
  });
}

/**
 * Poll the render state in-page until it matches `want`, and report the sample
 * that satisfied it (or `null` on timeout), with how long the wait took.
 *
 * Deliberately an in-page poll rather than `page.waitForFunction`, for the reason
 * documented in `helpers/game-ready.ts`: a driver-side poll evaluates on every
 * animation frame, and a driver round-trip per frame distorts the very timing this
 * test measures. It has to be in-page for a second reason too — the thing being
 * waited on is a page whose render loop has stopped.
 */
function waitForRendering(
  page: Page,
  want: 'running' | 'stopped',
  timeoutMs = 15_000,
): Promise<{ state: RenderingState; waitedMs: number } | null> {
  return page.evaluate(
    ({ want, timeout }) =>
      new Promise<{ state: RenderingState; waitedMs: number } | null>((resolve) => {
        const started = Date.now();
        const poll = () => {
          const state = ((window as any).__lampGameRendering?.() ?? null) as RenderingState | null;
          if (state && state.rendering === (want === 'running')) {
            return resolve({ state, waitedMs: Date.now() - started });
          }
          if (Date.now() - started >= timeout) return resolve(null);
          setTimeout(poll, 100);
        };
        poll();
      }),
    { want, timeout: timeoutMs },
  );
}

test.describe('Lamp of the Path — render-loop idling', () => {
  // A phone geometry, and not the default `devices['Desktop Chrome']` 1280x720.
  // Measured on the repo's own swiftshader backend: 1280x720@1 never finishes
  // booting within the 30s ceiling (the desktop layout path is the expensive one),
  // while every phone geometry boots in ~1.6s — so on the default viewport these
  // two tests skipped in CI and asserted nothing there. Nothing below depends on
  // the viewport (the lit-lamp count, the pan and the idle window are all
  // geometry-independent), so the smallest phone is the one that actually runs.
  test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });

  test('the engine stops rendering once the scene is still, and a tap starts it again', async ({ page }) => {
    await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });

    if (!await requireReadyGame(page, 'Idling')) return;

    const boot = await readRendering(page);
    expect(boot, 'the engine must publish __lampGameRendering').not.toBeNull();
    // A live verse. On a fresh profile only the *current* lamp is lit, so this is
    // 1 flame + 1 beam + 1 reflection = 3; it grows as the player lights lamps,
    // which is why the assertion is "some" rather than a fixed count.
    expect(boot!.ambientSprites).toBeGreaterThan(0);
    expect(boot!.reducedMotion).toBe(false);
    // …and it is rendering to begin with — the scene the player is looking at.
    expect(boot!.rendering).toBe(true);

    // Left alone, the ambient pulse runs out and the engine hands the GPU back.
    const stopped = await waitForRendering(page, 'stopped', AMBIENT_IDLE_MS + 10_000);
    expect(stopped, 'the engine never stopped rendering while nothing was moving').not.toBeNull();
    expect(stopped!.state.looping).toBe(false);
    // The stopping condition is the ambient idle timeout, not the wake window: if
    // the pulse had been frozen or the predicate ignored it, this would be ~150ms.
    expect(stopped!.state.quietMs).toBeGreaterThanOrEqual(AMBIENT_IDLE_MS);

    // Any touch brings it back, and brings the ambient pulse back with it.
    await page.locator('canvas').click();
    const resumed = await waitForRendering(page, 'running', 3000);
    expect(resumed, 'a tap did not restart the render loop').not.toBeNull();
    expect(resumed!.state.quietMs).toBeLessThan(WAKE_MS + 500);
  });

  test('prefers-reduced-motion freezes the ambient pulse, so the scene idles at the wake window', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });

    if (!await requireReadyGame(page, 'Idling (reduced motion)')) return;

    const boot = await readRendering(page);
    expect(boot).not.toBeNull();
    expect(boot!.reducedMotion).toBe(true);
    // The scene is complete — the sprites are there, they are simply never
    // animated. This is the distinction the test rests on: quiet, not empty.
    expect(boot!.ambientSprites).toBeGreaterThan(0);

    const stopped = await waitForRendering(page, 'stopped', 15_000);
    expect(stopped, 'the engine kept rendering with the ambient pulse frozen').not.toBeNull();
    // Half the ambient timeout, and comfortably above the wake window: with nothing
    // to animate, the only thing that kept the loop alive was the ~150ms after boot.
    // The bound is loose on purpose — a slow runner stretches a frame, and the stop
    // is noticed on a frame — but it still separates the two cases by 2x.
    expect(stopped!.state.quietMs).toBeLessThan(AMBIENT_IDLE_MS / 2);
  });
});
