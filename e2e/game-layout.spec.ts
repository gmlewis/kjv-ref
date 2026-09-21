import { test, expect, type Page } from '@playwright/test';
import { requireReadyGame } from './helpers/game-ready';

/**
 * The verse-band invariant: the DOM chrome and the canvas verse must not share a
 * band.
 *
 * This is the e2e half of the fix whose arithmetic lives in
 * `src/game/engine/layout.ts` (and is pinned by `layout.test.ts`). The unit test
 * proves the stack is self-consistent *for given numbers*; this spec is the only
 * thing that proves the engine was handed the *right* numbers — that the band the
 * DOM actually occupies on a real phone is the band the canvas was told to stay
 * below.
 *
 * The measured band is 117 CSS px on all three phones below, against the 88 px
 * the engine used to hardcode — so every canvas element in the top stack (the
 * stats line, the reference header and the first verse row) was positioned from a
 * guess that was 29 px short. The player-visible symptom was the verse sitting
 * under the translucent Peek card, which is a DOM *overlay* rather than chrome
 * and so cannot be measured from the canvas at all; the card is opaque now, and
 * the two chrome text lines are moving out of the canvas, which is what retires
 * that bleed. What this spec pins is the contract underneath: the canvas's top
 * band follows a measurement instead of a constant.
 *
 * It also asserts the render scale really did change. Both the crispness fix
 * (native device pixels) and the verse fix are invisible to every other spec in
 * this suite, because neither one changes the puzzle state the other tests read.
 *
 * ## Why it reads numbers instead of pixels
 *
 * The scene cannot be captured here: headless Chrome's default (Metal) WebGPU
 * backend boots the engine in about a second but composites nothing, so a
 * screenshot comes back pure black, and the software backend that does yield real
 * pixels boots slowly enough to hang under load — see `requireReadyGame`, which
 * skips these tests in exactly that environment. Everything asserted below is
 * therefore read from `window.__lampGameLayout` (published by the engine's
 * `relayout()`) and from `getBoundingClientRect` — state, not pixels. That is why
 * this spec still has teeth in CI: it skips for the same environmental reason the
 * other engine specs do, but when it runs it is checking the real geometry of a
 * real boot.
 */

/** The phones this is run at. The third is the player's own device. */
const PHONES = [
  { name: 'small phone', width: 360, height: 640, dpr: 2 },
  { name: 'mid phone', width: 384, height: 832, dpr: 2.5 },
  { name: 'Pixel 10 XL', width: 412, height: 917, dpr: 2.6214 },
] as const;

interface LayoutHook {
  surfaceScale: number;
  topInset: number;
  chromeBottom: number;
  headerY: number;
  hudY: number;
  hudFont: number;
  hudTextTop: number;
  hudTextBottom: number;
  slotAreaTop: number;
  verseTop: number;
  pathY: number;
  canvasCss: { W: number; H: number };
  bands: { sky: number; far: number; mid: number; near: number; bottom: number };
}

interface Probe {
  layout: LayoutHook;
  /** The lowest edge of the DOM chrome, in CSS px below the canvas top. */
  domBottom: number;
  /** How many chrome elements were measured — 0 would make `domBottom` vacuous. */
  chromeCount: number;
  /** The measured edges, for the failure message. */
  edges: Array<{ name: string; bottom: number }>;
}

/**
 * Read the engine's layout and, at the same instant, measure the DOM chrome.
 *
 * Both are read inside one `page.evaluate`, and the whole thing polls from *in
 * the page* rather than via `waitForFunction`. That is deliberate and matches
 * `game-ready.ts`: driver-side polling round-trips every animation frame, and a
 * WebGPU boot needs uninterrupted main-thread time. Polling here also means the
 * two readings cannot straddle a re-layout.
 *
 * Resolves `null` only if the inset never arrives, which is a real failure of the
 * measured-chrome path rather than something to skip.
 */
async function probeLayout(page: Page, timeoutMs = 15_000): Promise<Probe | null> {
  return page.evaluate(
    (timeout) =>
      new Promise<Probe | null>((resolve) => {
        const started = Date.now();
        const poll = () => {
          const layout = (window as any).__lampGameLayout as LayoutHook | undefined;
          const canvas = document.querySelector('canvas');
          // `topInset > 0` is the signal that the host has measured the chrome
          // and the engine has re-laid-out from that measurement.
          if (layout && canvas && layout.topInset > 0) {
            const canvasTop = canvas.getBoundingClientRect().top;
            const edges: Array<{ name: string; bottom: number }> = [];
            let domBottom = 0;
            for (const el of Array.from(document.querySelectorAll('[data-game-chrome]'))) {
              const r = el.getBoundingClientRect();
              // A hidden element (the prompt column unmounts while Peek is open)
              // measures 0 and must not drag the band back to the top.
              if (r.height <= 0) continue;
              const bottom = r.bottom - canvasTop;
              domBottom = Math.max(domBottom, bottom);
              edges.push({ name: el.getAttribute('data-game-chrome') ?? '?', bottom });
            }
            return resolve({ layout, domBottom, chromeCount: edges.length, edges });
          }
          if (Date.now() - started >= timeout) return resolve(null);
          setTimeout(poll, 250);
        };
        poll();
      }),
    timeoutMs,
  );
}

for (const phone of PHONES) {
  test.describe(`verse band on ${phone.name} (${phone.width}x${phone.height})`, () => {
    test.use({ viewport: { width: phone.width, height: phone.height }, deviceScaleFactor: phone.dpr });

    test(`the measured DOM chrome sits above the verse, and the canvas renders at native density`, async ({ page }) => {
      await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });

      if (!await requireReadyGame(page, `Layout test (${phone.name})`)) return;

      const probe = await probeLayout(page);
      // A null probe means the engine booted but never received a measured
      // inset: the host's observer did not fire, or the hook is not published.
      // That is the regression this spec exists to catch, so fail rather than
      // skip.
      expect(
        probe,
        `the engine never reported a measured top inset (status: ${await page.locator('body').innerText().then((t) => t.slice(0, 200))})`,
      ).not.toBeNull();
      const { layout, domBottom, chromeCount, edges } = probe!;
      const where = `chrome=${JSON.stringify(edges)} canvas=${JSON.stringify(layout.canvasCss)}`;

      // We must actually have measured the chrome — otherwise the invariants
      // below would hold trivially against a zero-height band.
      expect(chromeCount, `no [data-game-chrome] elements were measurable: ${where}`).toBeGreaterThan(0);
      expect(domBottom, `the measured chrome has no height: ${where}`).toBeGreaterThan(0);

      // --- The contract: the canvas reserves the band the DOM actually occupies
      // The engine was handed the band that was measured, so it is not laying the
      // verse out against a guess. This is the assertion that fails against the
      // pre-fix engine: with the inset ignored (the old hardcoded 88 px),
      // `chromeBottom` is 88 against a measured 117 on every phone here.
      //
      // The tolerance is the setter's own `setTopInset` deadband: a change under
      // 2 px is ignored on purpose, since a ResizeObserver fires on fractional
      // layout churn and each accepted change rebuilds the whole puzzle.
      expect(
        Math.abs(layout.topInset - domBottom),
        `the engine was told ${layout.topInset}px but the DOM chrome measures ${domBottom}px: ${where}`,
      ).toBeLessThanOrEqual(3);
      expect(layout.chromeBottom, where).toBeGreaterThanOrEqual(domBottom - 3);

      // …and no canvas ink lands in that band: the stats line starts below the
      // DOM's lowest edge. `chromeBottom` above is the band the layout *reserves*;
      // this is the glyph, which is what the player actually sees.
      expect(layout.hudTextTop, where).toBeGreaterThanOrEqual(domBottom);

      // The verse itself starts below the band too. Note this held before the fix
      // as well — the old stack put the verse at 156 against a 117 px band — so it
      // is a standing invariant rather than a regression test. The defect the
      // player reported was the verse sitting under the *Peek card*, a DOM overlay
      // the canvas cannot measure; that is why the card is now opaque, and why
      // the two chrome text lines are being moved out of the canvas entirely.
      expect(domBottom, `DOM chrome overlaps the verse band: ${where}`).toBeLessThan(layout.verseTop);

      // --- The stack invariants, verified against a live engine --------------
      // These mirror layout.test.ts. Here they are checked on real measured
      // numbers from a real boot rather than on invented ones.
      expect(layout.headerY, where).toBeLessThan(layout.hudTextTop);
      expect(layout.hudTextTop, where).toBeLessThan(layout.hudTextBottom);
      // The stats line clears the slot area with a real gap.
      expect(layout.hudTextBottom + 2, where).toBeLessThanOrEqual(layout.slotAreaTop);
      // The verse starts at least four HUD-line-heights below the measured DOM
      // chrome. This is the "frees room for the verse" claim, quantified.
      expect(layout.verseTop - domBottom, where).toBeGreaterThanOrEqual(layout.hudFont * 4);

      // The verse is above the causeway the lamps stand on, which is the other
      // direction this can break: a taller chrome must not push the verse down
      // onto the lamps.
      expect(layout.verseTop, where).toBeLessThan(layout.pathY);

      // --- The causeway is anchored to the canvas bottom ----------------------
      const { W: cssW, H: cssH } = layout.canvasCss;
      // Derived here rather than hardcoded, so it stays honest if the phone
      // breakpoints in layout.ts move.
      const isMobile = cssW < 560 || cssH < 650;
      expect(layout.pathY, where).toBe(cssH - (isMobile ? 84 : 64));

      // --- The scenery bands stay in canvas, in order -------------------------
      const { bands } = layout;
      expect(bands.sky, where).toBe(0);
      expect(bands.far, where).toBeLessThan(bands.mid); // ridge above the shoreline
      expect(bands.mid, where).toBeLessThan(bands.bottom);
      expect(bands.far, where).toBeGreaterThanOrEqual(0);
      expect(bands.bottom, where).toBeLessThanOrEqual(cssH);

      // --- Native-pixel rendering (the crispness fix) ------------------------
      // `maxDevicePixelRatio: 1` used to clamp this to exactly 1, so anything
      // meaningfully above 1 is proof the clamp is gone.
      expect(
        layout.surfaceScale,
        `the canvas is rendering at ${layout.surfaceScale} device px per CSS px: ${where}`,
      ).toBeGreaterThan(1);
      // …and it tracks the device rather than some fixed multiple of it.
      expect(
        Math.abs(layout.surfaceScale - phone.dpr) / phone.dpr,
        `surfaceScale ${layout.surfaceScale} does not match the device's ${phone.dpr}: ${where}`,
      ).toBeLessThanOrEqual(0.02);
    });
  });
}
