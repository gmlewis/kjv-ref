import { describe, it, expect } from 'vitest';
import { paletteFor, SCENERY_TEXT_COLORS } from './theme';

/**
 * `SCENERY_TEXT_COLORS` is the one palette decision the sunset made load-bearing:
 * the scenery is a dark dusk scene in **both** themes, so text drawn straight onto
 * it must not follow the theme. This is a pure module, so unlike the engine it can
 * be held to that — the defect it guards against (light mode's `#1e293b` vanishing
 * into the sky at 1.15:1) is invisible to every other test in the suite, because
 * the engine cannot run in jsdom and a headless capture of the scene is black.
 */

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The mean luminance of the pixel rows the end-of-session messages are drawn on,
 * measured against the approved composite at the player's device size
 * (1080x2404) by `/tmp/lamp-art/contrast.ts`. It is the dark upper sky, and it is
 * the same in both themes because the scene is.
 */
const MEASURED_UPPER_SKY_LUMINANCE = 0.012;

describe('SCENERY_TEXT_COLORS', () => {
  it('does not follow the theme, because the scenery does not', () => {
    // The whole point: whatever the theme, text on the scenery takes these.
    expect(SCENERY_TEXT_COLORS).toEqual({
      text: paletteFor('dark').text,
      accent: paletteFor('dark').accent,
    });
    // …and the light palette is genuinely different, so this is not a tautology:
    // if someone made it follow the theme, light mode would pick up `#1e293b`.
    expect(paletteFor('light').text).not.toBe(SCENERY_TEXT_COLORS.text);
    expect(luminance(paletteFor('light').text)).toBeLessThan(0.1);
  });

  it('reads on the sunset in both themes', () => {
    // The measured background as a luminance, fed through the same formula the
    // measurements used, so these numbers are comparable to the ones recorded in
    // the contrast run rather than being a fresh guess.
    const sky = MEASURED_UPPER_SKY_LUMINANCE;
    const ratio = (l: number, bg: number) => (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05);

    // The message text and the "Journey Complete!" accent, both far above the
    // 4.5:1 AA threshold for body text — they are drawn with no plate, so this is
    // the only thing keeping them legible.
    expect(ratio(luminance(SCENERY_TEXT_COLORS.text), sky)).toBeGreaterThan(7);
    expect(ratio(luminance(SCENERY_TEXT_COLORS.accent), sky)).toBeGreaterThan(4.5);

    // The counterfactual, stated as a test: what light mode's `text` would score
    // if these messages followed the theme. This is the defect, and it fails AA
    // by an order of magnitude.
    expect(ratio(luminance(paletteFor('light').text), sky)).toBeLessThan(1.5);
    expect(contrast(paletteFor('light').text, SCENERY_TEXT_COLORS.text)).toBeGreaterThan(7);
  });
});
