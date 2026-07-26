// Public re-exports for the "Lamp of the Path" game engine.
//
// The React host (`src/components/Game.tsx`) imports the engine factory and
// types from here via a dynamic `import('../game')` so the Babylon bundle is
// code-split and never weighs on the site's first load.

export { createLampGame } from './engine/LampGame';
export type {
  LampGame,
  LampGameOptions,
  LampGameCallbacks,
  LampResolveResult,
} from './engine/LampGame';

export { paletteFor } from './engine/theme';
export type { GameTheme, GamePalette } from './engine/theme';