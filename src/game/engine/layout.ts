/**
 * The game's vertical stack, as pure arithmetic.
 *
 * This lives outside `LampGame.ts` for one reason: the engine cannot be unit
 * tested at all (`@babylonjs/lite` is WebGPU-only and cannot run in jsdom), so
 * every layout bug in it is invisible until it is on a real screen. The verse
 * readability defect was exactly that — a canvas-drawn "Game Stats" line sharing
 * a band with the verse — so the arithmetic that decides those bands is worth
 * having somewhere a test can reach it.
 *
 * `LampGame.ts` keeps only the wiring: it hands these numbers to sprites and
 * text layers.
 *
 * Everything here is in **CSS pixels**, matching the rest of the layout maths in
 * the engine. The backing-store conversion happens at the engine's own choke
 * points, not here.
 */

/**
 * The measured height of the DOM chrome above the canvas — the mode-chip row,
 * the controls HUD and the prompt/stage column. The host measures it with a
 * `ResizeObserver` and feeds it in via `setTopInset`.
 *
 * It is a parameter rather than a constant because it *is* the layout's top
 * edge: when the canvas guessed at it with a hardcoded number, the guess drifted
 * from what the DOM actually rendered and canvas text ended up underneath the
 * DOM (the verse sitting behind the translucent Peek card).
 */
export const FALLBACK_TOP_OVERLAY_PX = { mobile: 88, desktop: 86 } as const;

/**
 * A single-line label's box height, as a multiple of the font size (ascent +
 * descent). Used only to derive `hudTextBottom` for the stack invariants — the
 * engine's text renderer measures its own glyphs.
 */
const LINE_BOX = 1.3;

/** Where the top of a text layer anchored at `baselineAnchor` actually sits. */
const TEXT_TOP_OFFSET = 0.65;

/**
 * The most of the canvas the DOM chrome may claim, as a fraction of its height.
 *
 * The inset is *measured from the DOM*, so it is an input this module does not
 * control; without a cap, one over-tall measurement (a wrapping chip row, a
 * stale observer) would push the slot area down onto the causeway and put the
 * verse behind the lamps. Clamping here rather than at each derived value keeps
 * the whole stack self-consistent. On every real device the chrome is well under
 * this, so the clamp is inert.
 */
const MAX_CHROME_FRACTION = 0.45;

export interface GameLayout {
  isMobile: boolean;
  isTiny: boolean;

  // Type sizes and cell metrics.
  margin: number;
  wordFont: number;
  headerFont: number;
  promptFont: number;
  hudFont: number;
  cellH: number;
  minCellW: number;
  cellPad: number;
  gap: number;

  /** The bottom of the DOM chrome. The canvas draws nothing above this. */
  chromeBottom: number;
  /** The reference header's baseline. */
  headerY: number;
  /** The stats line's anchor, and the box it occupies. */
  hudY: number;
  hudTextTop: number;
  hudTextBottom: number;
  /** The top of the slot area — the first row of the verse's answer slots. */
  slotAreaTop: number;
  /** The causeway the lamp row stands on, measured up from the canvas bottom. */
  pathY: number;
}

/**
 * Lay out the vertical stack for a canvas of `W`x`H` CSS px, with the DOM chrome
 * occupying `topOverlayHeightPx` at the top.
 *
 * Pass `topOverlayHeightPx <= 0` to use the fallback (see
 * `FALLBACK_TOP_OVERLAY_PX`), which is what a boot-time layout does before the
 * host has measured its overlay.
 */
export function computeGameLayout(
  W: number,
  H: number,
  topOverlayHeightPx: number = 0,
): GameLayout {
  const isMobile = W < 560 || H < 650;
  const isTiny = W < 380 || H < 580;

  const margin = isMobile ? 12 : 24;
  const wordFont = isTiny ? 14 : isMobile ? 16 : 22;
  const headerFont = isTiny ? 16 : isMobile ? 18 : 28;
  const promptFont = isTiny ? 11 : isMobile ? 12 : 18;
  const hudFont = isTiny ? 10 : isMobile ? 11 : 14;
  const cellH = isTiny ? 32 : isMobile ? 36 : 48;
  const minCellW = isTiny ? 48 : isMobile ? 58 : 84;
  const cellPad = isMobile ? 8 : 12;
  const gap = isMobile ? 5 : 10;

  // The chrome's bottom edge. A measurement of 0 (or less) means the host has
  // not reported one yet, so fall back to the historical estimate rather than
  // collapsing the stack onto the top edge of the canvas.
  const fallback = isMobile ? FALLBACK_TOP_OVERLAY_PX.mobile : FALLBACK_TOP_OVERLAY_PX.desktop;
  const chromeBottom = Math.min(
    topOverlayHeightPx > 0 ? topOverlayHeightPx : fallback,
    Math.max(fallback, H * MAX_CHROME_FRACTION),
  );

  // The reference header is aligned with the DOM's top bar buttons.
  const headerY = Math.round(headerFont * 1.0);

  // The stats line, and the slot area below it. Both are offsets scaled by
  // `hudFont` so the spacing stays proportional as the type shrinks on small
  // screens, rather than being three unrelated magic numbers.
  const hudY = chromeBottom + Math.round(hudFont * 4.0);
  const hudTextTop = hudY + hudFont * TEXT_TOP_OFFSET;
  const hudTextBottom = hudTextTop + hudFont * LINE_BOX;
  const slotAreaTop = hudY + Math.round(hudFont * 2.2);

  // The causeway the lamp row stands on.
  const pathY = isMobile ? H - 84 : H - 64;

  return {
    isMobile,
    isTiny,
    margin,
    wordFont,
    headerFont,
    promptFont,
    hudFont,
    cellH,
    minCellW,
    cellPad,
    gap,
    chromeBottom,
    headerY,
    hudY,
    hudTextTop,
    hudTextBottom,
    slotAreaTop,
    pathY,
  };
}
