// Light/dark palette for the "Lamp of the Path" engine.
//
// The engine reads the app's existing `kjv-theme` (light/dark) via the React
// host and looks up a palette here. Dark mode is the prettier mode for the
// game: lamps are the primary light source. Phase 0 uses flat colors; the
// scenery pass (Phase 1) will richen these without changing the shape.

export type GameTheme = 'light' | 'dark';

export interface GamePalette {
  background: string;
  text: string;
  tile: string;
  tileBorder: string;
  slot: string;
  /** Outline colour for blank (drop-target) slots — must contrast with `background`. */
  slotBorder: string;
  accent: string;
  lamp: string;
}

const LIGHT: GamePalette = {
  background: '#f8fafc',
  text: '#1e293b',
  tile: '#ffffff',
  tileBorder: '#cbd5e1',
  slot: '#e2e8f0',
  slotBorder: '#94a3b8', // slate-400 — clearly visible on the near-white background
  accent: '#f59e0b',
  lamp: '#fbbf24',
};

const DARK: GamePalette = {
  background: '#0b1220',
  text: '#e2e8f0',
  tile: '#1e293b',
  tileBorder: '#334155',
  slot: '#1e293b',
  slotBorder: '#64748b', // slate-500 — clearly visible on the near-black background
  accent: '#fbbf24',
  lamp: '#fde68a',
};

export function paletteFor(theme: GameTheme): GamePalette {
  return theme === 'dark' ? DARK : LIGHT;
}

/**
 * The colours for canvas text that sits **directly on the scenery**, with no plate
 * behind it. After the chrome move that is only the three end-of-session messages
 * ("No verses available", "Journey Complete! …", "Tap Play Again").
 *
 * It does not follow the theme, deliberately. The sunset is one dark dusk scene in
 * both themes — `scenery.ts` has no `isDark` branch — while `text` and `accent`
 * invert: light mode's `#1e293b` measures **1.15:1** against the upper sky these
 * messages are drawn on, which is dark slate on dark navy and effectively
 * invisible. Inverting the palette under a scene that never inverts is the trap
 * this constant exists to close; `theme.test.ts` pins it.
 *
 * Against the approved composite (`/tmp/lamp-art/05-sunset-harbor-in-game.png`,
 * sampled at the rows the messages occupy) the dark palette measures 13.7:1 for
 * `text` and 10.1:1 for `accent`, so no plate is needed once the colour stops
 * following the theme. Dark mode's appearance is unchanged.
 */
export const SCENERY_TEXT_COLORS = { text: DARK.text, accent: DARK.accent } as const;