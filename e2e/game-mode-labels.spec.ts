/**
 * The sub-mode selector chips (Journey / Race / Road) name the three ways to
 * play. Their labels used to be `hidden sm:inline`, so on a phone — below
 * Tailwind's 640px `sm` breakpoint — a player saw three unlabeled glyphs
 * (compass / lightning / plus) and had no way to tell the modes apart.
 *
 * These are DOM-only assertions: nothing here waits on the WebGPU engine, so
 * unlike the specs that read `window.__lampGame*` these run on any backend.
 */
import { test, expect } from '@playwright/test';

const MODES = [
  { label: 'Journey', title: 'Journey Mode — Walk the path and light lamps at your own pace', active: 'bg-amber-500' },
  { label: 'Race', title: 'Lantern Race — 60-second timed sprint recall', active: 'bg-orange-500' },
  { label: 'Road', title: 'Build a Road — Create a custom branch road for any passage', active: 'bg-indigo-500' },
];

// Phone widths: 360 is a common small Android, 384 is a Pixel-class CSS width,
// 412 is a Pixel 10 XL.
const PHONES = [
  { name: 'small phone', width: 360, height: 800 },
  { name: 'pixel-class phone', width: 384, height: 832 },
  { name: 'large phone', width: 412, height: 915 },
];

// The Controls HUD's icon buttons are icon-only on phones, by design: with all
// five labeled (`Peek` + `Skip` + sound + exit) the HUD needs ~152 CSS px and
// would run into the mode chips below ~440px. Their names live in aria-label /
// title instead — assert that they are still there.
const HUD_ICONS = ['Peek verse text', 'Mute sound', 'Unmute sound', 'Exit'];

test.describe('Game — sub-mode selector labels', () => {
  for (const phone of PHONES) {
    test(`mode names are visible next to the icons at ${phone.name} width (${phone.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: phone.width, height: phone.height });
      await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(`button[title="${MODES[0].title}"]`, { timeout: 20_000 });

      const layout = await page.evaluate((titles: string[]) => {
        const rectOf = (el: Element, name: string) => {
          const r = el.getBoundingClientRect();
          return { name, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width };
        };
        const modes = titles.map((title) => {
          const el = document.querySelector(`button[title="${title}"]`)!;
          const text = el.textContent ?? '';
          return { ...rectOf(el, text.trim() || title), text };
        });
        const hud = [...document.querySelectorAll('button[aria-label]')]
          .filter((el) => ['Peek verse text', 'Hide verse text', 'Skip this lamp', 'Mute sound', 'Unmute sound', 'Exit']
            .includes(el.getAttribute('aria-label') ?? ''))
          .map((el) => rectOf(el, el.getAttribute('aria-label')!));
        return { modes, hud, innerWidth: window.innerWidth };
      }, MODES.map((m) => m.title));

      // Each chip shows its name, on a phone.
      for (const [i, mode] of MODES.entries()) {
        expect(layout.modes[i].text, `${mode.label} chip text`).toContain(mode.label);
        expect(layout.modes[i].width, `${mode.label} chip width`).toBeGreaterThan(40);
      }

      // The whole row stays on screen and clear of the Controls HUD — with 32px
      // of slack for the conditional "Skip this lamp" chip, which moves the HUD
      // left by one button when it appears.
      const hudLeft = Math.min(...layout.hud.map((r) => r.x));
      const topRow = layout.modes.filter((r) => Math.abs(r.y - layout.modes[0].y) < 2);
      const topRowRight = Math.max(...topRow.map((r) => r.right));
      for (const r of [...layout.modes, ...layout.hud]) {
        expect(r.x, `${r.name} starts on screen`).toBeGreaterThanOrEqual(0);
        expect(r.right, `${r.name} ends on screen`).toBeLessThanOrEqual(layout.innerWidth);
      }
      expect(topRowRight + 32, 'mode chips clear of the Controls HUD').toBeLessThanOrEqual(hudLeft);

      // The HUD's icon-only buttons keep accessible names.
      const hudNames = await page.evaluate((names: string[]) =>
        names.filter((n) => document.querySelector(`button[aria-label="${n}"]`)).length, HUD_ICONS);
      expect(hudNames, 'HUD icon buttons have accessible names').toBeGreaterThan(0);
    });
  }

  test('Journey is the default mode on a fresh load', async ({ page }) => {
    await page.goto('/kjv-ref/practice/game', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`button[title="${MODES[0].title}"]`, { timeout: 20_000 });

    const classes = await page.evaluate((titles: string[]) =>
      titles.map((title) => document.querySelector(`button[title="${title}"]`)?.className ?? ''), MODES.map((m) => m.title));

    expect(classes[0], 'Journey chip is the active one').toContain('bg-amber-500');
    expect(classes[1], 'Race chip is not active').not.toContain('bg-orange-500');
    expect(classes[2], 'Road chip is not active').not.toContain('bg-indigo-500');
  });
});
