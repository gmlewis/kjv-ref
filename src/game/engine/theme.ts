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
  accent: string;
  lamp: string;
}

const LIGHT: GamePalette = {
  background: '#f8fafc',
  text: '#1e293b',
  tile: '#ffffff',
  tileBorder: '#cbd5e1',
  slot: '#e2e8f0',
  accent: '#f59e0b',
  lamp: '#fbbf24',
};

const DARK: GamePalette = {
  background: '#0b1220',
  text: '#e2e8f0',
  tile: '#1e293b',
  tileBorder: '#334155',
  slot: '#0f172a',
  accent: '#fbbf24',
  lamp: '#fde68a',
};

export function paletteFor(theme: GameTheme): GamePalette {
  return theme === 'dark' ? DARK : LIGHT;
}