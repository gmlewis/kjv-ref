// Babylon Lite engine shell for "Lamp of the Path" (task C-2).
//
// CONTRACT: the React host (`src/components/Game.tsx`) calls `createLampGame`
// with a canvas, theme, the player's verse pool / progress / due data, and a
// single `onResolve` callback. The engine owns the canvas and all input; EVERY
// decision (which verse next, what scaffold layer, scoring) goes through the
// pure modules in `src/game/` — this file contains no testable branching logic,
// only layout math, input wiring, and rendering. The host owns the React chrome
// (exit button, theme sync) and wires `onResolve` to the existing progress /
// review / session / daily-goal mutations, so progress is unified across all
// 8 modes.
//
// Phase 0: a plain canvas (no scenery). A verse is presented as a row of word
// slots; the player drags word tiles from a bank into the blank slots (pointer
// or touch), or types the verse for free-recall (L5), or taps to continue for
// the read-along (L0). Resolving scores via the pure modules and reports through
// `onResolve`, then loads the next verse.
//
// The engine is WebGPU-only (Babylon Lite has no WebGL fallback by design). If
// `navigator.gpu` is absent, `createLampGame` rejects and the host shows its
// error state. The engine cannot run in jsdom, so it has no unit tests by design;
// its logic is exercised through the pure modules and its wiring through e2e.

import {
  createEngine,
  startEngine,
  disposeEngine,
  resizeEngine,
  loadFont,
  createDefaultTextData,
  updateDefaultTextData,
  disposeDefaultTextData,
  createTextLayer,
  createTextRenderer,
  registerTextRenderer,
  unregisterTextRenderer,
  addTextRendererLayer,
  removeTextRendererLayer,
  createSpriteAtlasFromFrames,
  createSprite2DLayer,
  createSpriteRenderer,
  registerSpriteRenderer,
  disposeSpriteRenderer,
  addSprite2D,
  updateSprite2D,
  removeSprite2D,
} from '@babylonjs/lite';
import type {
  EngineContext,
  Font,
  SpriteRenderer,
  Sprite2DLayer,
  Sprite2DHandle,
  TextRenderer,
  TextLayer,
  DefaultTextData,
} from '@babylonjs/lite';
import type { KJVVerse } from '../../data/kjv-verses';
import type { ProgressEntry, DueEntry, TilePuzzle, ScaffoldLayer } from '../types';
import { selectNextLamps } from '../selection';
import { getGameLayer, buildTilePuzzle } from '../scaffold';
import { scoreTilePuzzle, performanceRating, computeXp, applyCombo, levelForXp } from '../scoring';
import { loadGameState, saveGameState } from '../state';
import { playTileSnapSound, playTileErrorSound, playLampLitSound } from './audio';
import type { PerformanceRating } from '../scoring';
import { paletteFor } from './theme';
import type { GameTheme } from './theme';
import { createGameSpriteFrames } from './art';

/** Result of one lamp resolve, reported to the host so it can write progress. */
export interface LampResolveResult {
  reference: string;
  correct: boolean;
  accuracy: number;
  rating: PerformanceRating;
  fluent: boolean;
  usedHint: boolean;
  /** XP earned for this resolve (already applied to the cosmetic game state). */
  earnedXp: number;
}

export interface LampGameCallbacks {
  /** Called by the engine each time the player resolves a lamp. */
  onResolve: (result: LampResolveResult) => void;
  /** Called when the active verse (and its scaffold stage) changes so the host
   *  UI can sync state (Peek feature, stage indicator/selector). */
  onVerseChange?: (verse: KJVVerse, stage: ScaffoldLayer, prompt: string) => void;
  /** Called when all lamps in the session queue are lit. */
  onSessionComplete?: (stats: { totalXp: number; lampsLit: number; bestCombo: number }) => void;
}

export interface LampGameOptions {
  canvas: HTMLCanvasElement;
  theme: GameTheme;
  reducedMotion: boolean;
  /** Verses available to practice (unlocked regions + built roads). */
  pool: KJVVerse[];
  /** Current per-verse progress (for scaffold-layer selection + lamp states). */
  progress: ProgressEntry[];
  /** Due-review entries (for due-first ordering + dimming). */
  due: DueEntry[];
  /** Whether today's daily goal is already met (suppresses new verses). */
  dailyGoalCompleted: boolean;
  callbacks: LampGameCallbacks;
}

export interface LampGame {
  /** Tear down the scene and free GPU memory. Called by the host on unmount. */
  dispose(): void;
  /** Live-switch the palette when the user toggles dark mode. */
  setTheme(theme: GameTheme): void;
  /** Override the current verse's scaffold stage and rebuild its puzzle
   *  immediately. The host is responsible for persisting the override via
   *  `useSetClozeLevelMutation`; this call only changes the live puzzle. */
  setStage(stage: ScaffoldLayer | null): void;
  /** Optional getter for current puzzle state (used in E2E tests). */
  getPuzzle?(): TilePuzzle | null;
}

// ---------------------------------------------------------------------------
// Layout constants (CSS pixels — sprite + text-layer position units match).
// ---------------------------------------------------------------------------
const HEADER_FONT = 34;
const WORD_FONT = 26;
const PROMPT_FONT = 18;
const TYPED_FONT = 26;
const CELL_H = 52;
const MIN_CELL_W = 84;
const CELL_PAD = 14;
const GAP = 10;
const MARGIN = 24;
const HEADER_Y = 60;
const SLOT_AREA_TOP = 175;
const BANK_BOTTOM_PAD = 96;
const BORDER_T = 2; // outline thickness (CSS px) for blank slot drop-targets

// ---------------------------------------------------------------------------
// Color helpers. Palette colors are sRGB hex; sprites tint a white 1x1 atlas
// (sRGB-normalized values), text colors are linear RGBA per the Lite text API.
// ---------------------------------------------------------------------------
function hexToBytes(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function spriteColor(hex: string, a = 1): [number, number, number, number] {
  const [r, g, b] = hexToBytes(hex);
  return [r / 255, g / 255, b / 255, a];
}
function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function textColor(hex: string, a = 1): [number, number, number, number] {
  const [r, g, b] = hexToBytes(hex);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), a];
}

interface SlotView {
  index: number;
  word: string;
  preFilled: boolean;
  x: number; y: number; w: number; h: number; // cell top-left + size
  sprite: Sprite2DHandle;
  /** 4 thin outline quads (top/bottom/left/right) drawn only for blank slots,
   *  so the drop target stays visible against the background. Empty for pre-filled. */
  borders: Sprite2DHandle[];
  textLayer?: TextLayer;
  textData?: DefaultTextData;
}
interface TileView {
  id: string;
  word: string;
  display: string;
  homeX: number; homeY: number; // bank cell top-left
  curX: number; curY: number;
  w: number; h: number;
  sprite: Sprite2DHandle;
  textLayer: TextLayer;
  textData: DefaultTextData;
  placedSlotIndex: number | null;
}

/**
 * Boot the game into `opts.canvas`. Returns a handle whose `dispose()` tears
 * down the scene and `setTheme()` live-swaps the palette.
 */
export async function createLampGame(opts: LampGameOptions): Promise<LampGame> {
  const { canvas, callbacks } = opts;
  const onResolve = callbacks.onResolve;

  if (!(navigator as any).gpu) {
    throw new Error(
      'WebGPU is not available in this browser. The Lamp of the Path game requires WebGPU (Chrome/Edge 113+, or recent Firefox/Safari).',
    );
  }

  const engine: EngineContext = await createEngine(canvas, { maxDevicePixelRatio: 1 });
  const font: Font = await loadFont(`${import.meta.env.BASE_URL}fonts/Inter.ttf`);

  let theme: GameTheme = opts.theme;
  let palette = paletteFor(theme);
  let disposed = false;

  // Vector art atlas generated from art.ts frames.
  const spriteFrames = createGameSpriteFrames();
  const frameMap = new Map<string, number>(spriteFrames.map((f, i) => [f.name, i]));
  const frameIndex = (name: string): number => frameMap.get(name) ?? 0;

  const atlas = createSpriteAtlasFromFrames(engine, spriteFrames, { srgb: true });
  const spriteLayer: Sprite2DLayer = createSprite2DLayer(atlas, { capacity: 512, depth: 'none' });
  const spriteRenderer: SpriteRenderer = createSpriteRenderer(engine, {
    layers: [spriteLayer],
    clear: true,
  });
  registerSpriteRenderer(spriteRenderer);

  // Text draws on top of the sprite pass (clear:false preserves tile color).
  const textRenderer: TextRenderer = createTextRenderer(engine, { layers: [], clear: false });
  registerTextRenderer(textRenderer);

  // --- Session state -------------------------------------------------------
  // The host passes a progress *snapshot* at boot; persisted updates happen via
  // `onResolve` and aren't re-read here. To advance the scaffold within a
  // session, the engine keeps a local recitation counter per verse and feeds it
  // to the pure `getGameLayer` decision — the decision itself stays pure.
  const sessionRecited = new Map<string, number>();
  const progressFor = (ref: string): ProgressEntry | undefined =>
    opts.progress.find((p) => p?.verse?.reference === ref);

  let queue: KJVVerse[] = selectNextLamps({
    pool: opts.pool,
    progress: opts.progress,
    due: opts.due,
    dailyGoalCompleted: opts.dailyGoalCompleted,
    limit: 12,
  });
  if (queue.length === 0) queue = opts.pool.slice(0, 12); // fallback: no due, goal done
  let queueIndex = 0;

  // Candidate words (from every unlocked verse) from which decoy (wrong) tiles
  // are drawn for stages ≥ 2. Built once per session from the host's pool.
  const decoyPool: string[] = opts.pool.flatMap((v) => v.text.split(' '));

  // Current puzzle view state.
  let verse: KJVVerse | null = null;
  let puzzle: ReturnType<typeof buildTilePuzzle> | null = null;
  let slots: SlotView[] = [];
  let tiles: TileView[] = [];
  let headerLayer: TextLayer | null = null;
  let headerData: DefaultTextData | null = null;
  let promptLayer: TextLayer | null = null;
  let promptData: DefaultTextData | null = null;
  let hudLayer: TextLayer | null = null;
  let hudData: DefaultTextData | null = null;
  let feedbackLayer: TextLayer | null = null;
  let feedbackData: DefaultTextData | null = null;
  let feedbackBgSprite: Sprite2DHandle | null = null;
  let slotBottomY = 220;
  let bankTopY = 500;
  let bgSprite: Sprite2DHandle | null = null;
  let skyGradientSprite: Sprite2DHandle | null = null;
  let moonSprite: Sprite2DHandle | null = null;
  let mountainSprite: Sprite2DHandle | null = null;
  let hillsSprite: Sprite2DHandle | null = null;
  let forestHillsSprite: Sprite2DHandle | null = null;
  let oceanWaterSprite: Sprite2DHandle | null = null;
  let waterfallSprite: Sprite2DHandle | null = null;
  let citySprite: Sprite2DHandle | null = null;
  let pathSprite: Sprite2DHandle | null = null;
  let skyStarSprites: Sprite2DHandle[] = [];
  let lampSprites: Sprite2DHandle[] = [];
  let lighthouseSprites: Sprite2DHandle[] = [];
  let lampHaloSprites: Sprite2DHandle[] = [];
  let lampFlameSprites: Sprite2DHandle[] = [];
  let beaconBeamSprites: Sprite2DHandle[] = [];
  let gameState = loadGameState();
  const sessionLitRefs = new Set<string>();
  let combo = 0;
  let puzzleStartMs = 0;
  let resolving = false;
  // Player-chosen stage override for the CURRENT verse only. Set by `setStage`
  // (host persists it via useSetClozeLevelMutation); cleared when a new verse
  // is loaded so each verse starts at its own computed/auto stage.
  let stageOverride: ScaffoldLayer | null = null;
  // When true (set by setStage(null) = "Auto"), the auto stage ignores any
  // persisted customClozeLevel so the verse reverts to a pure recitation-based
  // stage. Reset when a new verse loads.
  let ignorePersistedOverride = false;
  // When true, the incorrect-answer feedback banner is showing and the engine
  // is waiting for a tap to dismiss it and return the misplaced tiles to the bank.
  let awaitingRetryTap = false;
  // Per-slot correctness of the most recent tile-puzzle attempt, retained so the
  // dismiss handler can reset borders / return misplaced tiles after the player
  // has read the feedback.
  let lastSlotCorrectness: boolean[] = [];

  // --- Input state ---------------------------------------------------------
  let dragging: TileView | null = null;
  let dragOffX = 0;
  let dragOffY = 0;
  let dragPointerId: number | null = null;

  // =========================================================================
  // Layout: wrap variable-width cells into centered rows within an area.
  // =========================================================================
  function canvasSize(): [number, number] {
    return [canvas.clientWidth || canvas.width || 1, canvas.clientHeight || canvas.height || 1];
  }

  function getResponsiveMetrics(W: number, H: number) {
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

    // Dynamic layout math — vertical positions are calculated from font metrics
    // and the measured DOM overlay height to eliminate arbitrary magic numbers:
    // 1. Reference header baseline: aligned with top bar buttons.
    const headerY = Math.round(headerFont * 1.0);

    // 2. Estimated bottom of DOM Stage overlay (top-offset + prompt + stage pill height).
    const domStageBottom = isMobile ? 88 : 86;

    // 3. HUD Stats baseline: dynamically offset below DOM stage overlay using hudFont scale.
    const hudY = domStageBottom + Math.round(hudFont * 4.0);

    // 4. Slot Area Top: dynamically offset below HUD Stats baseline using hudFont scale.
    const slotAreaTop = hudY + Math.round(hudFont * 2.2);

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
      headerY,
      hudY,
      slotAreaTop,
    };
  }

  function getCompactBankArea(
    tileWidths: number[],
    maxAreaW: number,
    canvasW: number,
    cellH: number,
    gap: number,
    isMobile: boolean,
  ): { bankAreaX: number; bankAreaW: number } {
    if (isMobile || tileWidths.length <= 2 || maxAreaW <= 520) {
      return { bankAreaX: (canvasW - maxAreaW) / 2, bankAreaW: maxAreaW };
    }

    const n = tileWidths.length;
    const targetRatio = 1.5; // Target aspect ratio (width / height) for compact near-square desktop bank block
    let bestW = maxAreaW;
    let bestDiff = Infinity;

    for (let r = 2; r <= Math.min(n, 6); r++) {
      const itemsPerRow = Math.ceil(n / r);
      let maxRowW = 0;
      for (let i = 0; i < n; i += itemsPerRow) {
        const rowSlice = tileWidths.slice(i, i + itemsPerRow);
        const rw = rowSlice.reduce((acc, w) => acc + w, 0) + Math.max(0, rowSlice.length - 1) * gap;
        if (rw > maxRowW) maxRowW = rw;
      }

      const candidateW = Math.min(maxAreaW, maxRowW + 4);
      let actualRows = 1;
      let curW = 0;
      for (const w of tileWidths) {
        if (curW > 0 && curW + gap + w > candidateW) {
          actualRows++;
          curW = w;
        } else {
          curW += (curW > 0 ? gap : 0) + w;
        }
      }

      const blockH = actualRows * cellH + (actualRows - 1) * gap;
      const ratio = candidateW / blockH;
      const diff = Math.abs(ratio - targetRatio);

      if (diff < bestDiff && candidateW <= maxAreaW) {
        bestDiff = diff;
        bestW = candidateW;
      }
    }

    const constrainedW = Math.min(maxAreaW, Math.max(360, Math.min(bestW, 680)));
    const bankAreaX = Math.round((canvasW - constrainedW) / 2);
    return { bankAreaX, bankAreaW: constrainedW };
  }

  function wrapLayout(
    widths: number[],
    areaX: number,
    areaW: number,
    startY: number,
    cellH: number,
    gap: number = GAP,
  ): { x: number; y: number }[] {
    const pos: { x: number; y: number }[] = [];
    let y = startY;
    let row: number[] = [];
    let rowW = 0;
    const flush = () => {
      if (row.length === 0) return;
      const total = row.reduce((s, w, i) => s + widths[row[i]] + (i > 0 ? gap : 0), 0);
      let x = areaX + Math.max(0, (areaW - total) / 2);
      for (const wi of row) {
        pos[wi] = { x, y };
        x += widths[wi] + gap;
      }
      y += cellH + gap;
      row = [];
      rowW = 0;
    };
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];
      if (row.length > 0 && rowW + gap + w > areaW) flush();
      row.push(i);
      rowW += (row.length > 1 ? gap : 0) + w;
    }
    flush();
    return pos;
  }

  // =========================================================================
  // Sprite/text positioning helpers.
  // =========================================================================
  function placeSprite(sprite: Sprite2DHandle, x: number, y: number, w: number, h: number, color: [number, number, number, number]) {
    // Layer pivot is center (default [0.5,0.5]); positionPx is the quad center.
    updateSprite2D(sprite, { positionPx: [x + w / 2, y + h / 2], sizePx: [w, h], color });
  }
  function placeText(
    layer: TextLayer,
    data: DefaultTextData,
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number,
    fontSizePx: number = WORD_FONT,
  ) {
    // In Babylon Lite WebGPU shader, glyph Y ascends by font ascender (~0.75 * fontSizePx) above layer.positionPx.y.
    // Setting layer.positionPx.y = cellY + (cellH / 2) + (fontSizePx * 0.25) places top of font at cellY + 9px
    // and bottom of font descenders at cellY + cellH - 9px, producing exact 9px equal top & bottom padding.
    const baselineY = cellY + cellH / 2 + fontSizePx * 0.25;
    layer.positionPx = {
      x: cellX + Math.max(0, (cellW - data.width) / 2),
      y: baselineY,
    };
  }
  function setTilePos(t: TileView, x: number, y: number) {
    t.curX = x;
    t.curY = y;
    placeSprite(t.sprite, x, y, t.w, t.h, [1, 1, 1, 1]);
    placeText(t.textLayer, t.textData, x, y, t.w, t.h);
  }
  /** Position the 4 outline quads of a blank slot's drop-target border. */
  function placeSlotBorders(s: SlotView) {
    if (s.borders.length === 0) return;
    const col: [number, number, number, number] = [245 / 255, 158 / 255, 11 / 255, 1];
    const T = BORDER_T;
    const { x, y, w, h } = s;
    placeSprite(s.borders[0], x, y, w, T, col); // top
    placeSprite(s.borders[1], x, y + h - T, w, T, col); // bottom
    placeSprite(s.borders[2], x, y, T, h, col); // left
    placeSprite(s.borders[3], x + w - T, y, T, h, col); // right
  }

  // =========================================================================
  // Puzzle teardown / build.
  // =========================================================================
  function teardownPuzzle() {
    for (const s of slots) {
      removeSprite2D(s.sprite);
      for (const b of s.borders) removeSprite2D(b);
      if (s.textLayer) removeTextRendererLayer(textRenderer, s.textLayer);
      if (s.textData) disposeDefaultTextData(s.textData);
    }
    for (const t of tiles) {
      removeSprite2D(t.sprite);
      removeTextRendererLayer(textRenderer, t.textLayer);
      disposeDefaultTextData(t.textData);
    }
    if (headerLayer) {
      removeTextRendererLayer(textRenderer, headerLayer);
      headerLayer = null;
    }
    if (headerData) {
      disposeDefaultTextData(headerData);
      headerData = null;
    }
    if (promptLayer) {
      removeTextRendererLayer(textRenderer, promptLayer);
      promptLayer = null;
    }
    if (promptData) {
      disposeDefaultTextData(promptData);
      promptData = null;
    }
    if (hudLayer) {
      removeTextRendererLayer(textRenderer, hudLayer);
      hudLayer = null;
    }
    if (hudData) {
      disposeDefaultTextData(hudData);
      hudData = null;
    }
    if (feedbackLayer) {
      removeTextRendererLayer(textRenderer, feedbackLayer);
      feedbackLayer = null;
    }
    if (feedbackData) {
      disposeDefaultTextData(feedbackData);
      feedbackData = null;
    }
    if (feedbackBgSprite) {
      removeSprite2D(feedbackBgSprite);
      feedbackBgSprite = null;
    }
    for (const ls of lampSprites) removeSprite2D(ls);
    for (const lhs of lighthouseSprites) removeSprite2D(lhs);
    for (const lhs of lampHaloSprites) removeSprite2D(lhs);
    for (const lfs of lampFlameSprites) removeSprite2D(lfs);
    for (const bbs of beaconBeamSprites) removeSprite2D(bbs);
    for (const ss of skyStarSprites) removeSprite2D(ss);
    if (skyGradientSprite) {
      removeSprite2D(skyGradientSprite);
      skyGradientSprite = null;
    }
    if (moonSprite) {
      removeSprite2D(moonSprite);
      moonSprite = null;
    }
    if (mountainSprite) {
      removeSprite2D(mountainSprite);
      mountainSprite = null;
    }
    if (hillsSprite) {
      removeSprite2D(hillsSprite);
      hillsSprite = null;
    }
    if (forestHillsSprite) {
      removeSprite2D(forestHillsSprite);
      forestHillsSprite = null;
    }
    if (oceanWaterSprite) {
      removeSprite2D(oceanWaterSprite);
      oceanWaterSprite = null;
    }
    if (waterfallSprite) {
      removeSprite2D(waterfallSprite);
      waterfallSprite = null;
    }
    if (citySprite) {
      removeSprite2D(citySprite);
      citySprite = null;
    }
    lampSprites = [];
    lampHaloSprites = [];
    lampFlameSprites = [];
    skyStarSprites = [];
    slots = [];
    tiles = [];
    puzzle = null;
    verse = null;
    dragging = null;
    dragPointerId = null;
    awaitingRetryTap = false;
  }

  function buildPuzzle(v: KJVVerse) {
    teardownPuzzle();
    verse = v;

    const boot = progressFor(v.reference);
    const timesRecited = sessionRecited.get(v.reference) ?? boot?.timesRecited ?? 0;
    // A live override (from setStage) wins; otherwise the auto stage is computed
    // from this session's recitations + the persisted override + mastered status.
    // When the player chose "Auto" (setStage(null)) the persisted override is
    // deliberately ignored so the verse reverts to a pure recitation-based stage.
    const customForAuto = ignorePersistedOverride ? null : (boot?.customClozeLevel ?? null);
    const stage: ScaffoldLayer =
      stageOverride ?? getGameLayer(timesRecited, customForAuto as any, boot?.status);
    puzzle = buildTilePuzzle(v, stage, queueIndex + 1, decoyPool);
    // The stage instruction is rendered by the host as a DOM row (paired with the
    // stage-control chips), NOT on the canvas, so the chips can sit beside it.
    const isStudy = puzzle.bank.length === 0;
    const promptText = isStudy
      ? 'Verse Stage 0 — Read the verse, then tap to continue'
      : puzzle.decoyCount > 0
        ? `Verse Stage ${puzzle.layer} — Tap the words in order (${puzzle.decoyCount} wrong words mixed in)`
        : `Verse Stage ${puzzle.layer} — Tap the words in order`;
    opts.callbacks.onVerseChange?.(v, stage, promptText);

    const [W, H] = canvasSize();
    const {
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
      headerY,
      hudY,
      slotAreaTop,
    } = getResponsiveMetrics(W, H);

    const areaX = margin;
    const areaW = W - 2 * margin;

    const isDark = theme === 'dark';

    // Sky Background (Atmospheric gradient sky)
    if (!skyGradientSprite) {
      skyGradientSprite = addSprite2D(spriteLayer, {
        positionPx: [W / 2, H / 2],
        sizePx: [W, H],
        color: [1, 1, 1, 1],
        frame: frameIndex(isDark ? 'sky_dark' : 'sky_light'),
      });
    } else {
      updateSprite2D(skyGradientSprite, {
        positionPx: [W / 2, H / 2],
        sizePx: [W, H],
        color: [1, 1, 1, 1],
        frame: frameIndex(isDark ? 'sky_dark' : 'sky_light'),
      });
    }

    // Celestial Moon (Dark mode upper-right sky)
    if (isDark && !moonSprite) {
      moonSprite = addSprite2D(spriteLayer, {
        positionPx: [W * 0.88, H * 0.14],
        sizePx: [36, 36],
        color: [1, 1, 1, 0.95],
        frame: frameIndex('moon'),
      });
    } else if (isDark && moonSprite) {
      updateSprite2D(moonSprite, {
        positionPx: [W * 0.88, H * 0.14],
        sizePx: [36, 36],
        color: [1, 1, 1, 0.95],
        frame: frameIndex('moon'),
      });
    }

    // Celestial Starfield (Dark mode twinkling stars)
    if (isDark && skyStarSprites.length === 0) {
      const starPositions = [
        [0.06, 0.08], [0.18, 0.14], [0.32, 0.06], [0.46, 0.12],
        [0.58, 0.07], [0.72, 0.16], [0.82, 0.08], [0.94, 0.18],
        [0.12, 0.22], [0.28, 0.26], [0.52, 0.24], [0.66, 0.28],
        [0.78, 0.22], [0.88, 0.26], [0.38, 0.18], [0.04, 0.28],
      ];
      for (const [rx, ry] of starPositions) {
        skyStarSprites.push(
          addSprite2D(spriteLayer, {
            positionPx: [W * rx, H * ry],
            sizePx: [12, 12],
            color: [1, 1, 1, 0.85],
            frame: frameIndex('star'),
          }),
        );
      }
    }

    // Walking Path Y-position (Prominent lower-third of canvas)
    const pathY = isMobile ? H - 84 : H - 64;

    // Distant Mountain Ridge Scenery
    if (!mountainSprite) {
      mountainSprite = addSprite2D(spriteLayer, {
        positionPx: [W / 2, pathY - 54],
        sizePx: [W, 80],
        color: isDark ? [1, 1, 1, 0.8] : [1, 1, 1, 0.55],
        frame: frameIndex('mountain'),
      });
    } else {
      updateSprite2D(mountainSprite, {
        positionPx: [W / 2, pathY - 54],
        sizePx: [W, 80],
        color: isDark ? [1, 1, 1, 0.8] : [1, 1, 1, 0.55],
        frame: frameIndex('mountain'),
      });
    }

    // Lush Emerald Forest Hillsides
    if (!forestHillsSprite) {
      forestHillsSprite = addSprite2D(spriteLayer, {
        positionPx: [W / 2, pathY - 32],
        sizePx: [W, 64],
        color: isDark ? [1, 1, 1, 0.95] : [1, 1, 1, 0.85],
        frame: frameIndex('forest_hills'),
      });
    } else {
      updateSprite2D(forestHillsSprite, {
        positionPx: [W / 2, pathY - 32],
        sizePx: [W, 64],
        color: isDark ? [1, 1, 1, 0.95] : [1, 1, 1, 0.85],
        frame: frameIndex('forest_hills'),
      });
    }

    // Cascading Waterfall Stream on the Hillside
    if (!waterfallSprite) {
      waterfallSprite = addSprite2D(spriteLayer, {
        positionPx: [W * 0.22, pathY - 22],
        sizePx: [16, 44],
        color: [1, 1, 1, 0.95],
        frame: frameIndex('waterfall'),
      });
    } else {
      updateSprite2D(waterfallSprite, {
        positionPx: [W * 0.22, pathY - 22],
        sizePx: [16, 44],
        color: [1, 1, 1, 0.95],
        frame: frameIndex('waterfall'),
      });
    }

    // Illuminated City on a Hill Citadel Skyline
    if (!citySprite) {
      citySprite = addSprite2D(spriteLayer, {
        positionPx: [W * 0.76, pathY - 60],
        sizePx: [160, 64],
        color: isDark ? [1, 1, 1, 0.95] : [0.9, 0.9, 1, 0.75],
        frame: frameIndex('city'),
      });
    } else {
      updateSprite2D(citySprite, {
        positionPx: [W * 0.76, pathY - 60],
        sizePx: [160, 64],
        color: isDark ? [1, 1, 1, 0.95] : [0.9, 0.9, 1, 0.75],
        frame: frameIndex('city'),
      });
    }

    // Shimmering Blue Coastal Ocean Water Body
    if (!oceanWaterSprite) {
      oceanWaterSprite = addSprite2D(spriteLayer, {
        positionPx: [W / 2, pathY + 16],
        sizePx: [W, 36],
        color: [1, 1, 1, 0.95],
        frame: frameIndex('ocean_water'),
      });
    } else {
      updateSprite2D(oceanWaterSprite, {
        positionPx: [W / 2, pathY + 16],
        sizePx: [W, 36],
        color: [1, 1, 1, 0.95],
        frame: frameIndex('ocean_water'),
      });
    }

    // Textured Cobblestone Path Bar
    if (!pathSprite) {
      pathSprite = addSprite2D(spriteLayer, {
        positionPx: [W / 2, pathY],
        sizePx: [W - 2 * margin, 24],
        color: [1, 1, 1, 0.95],
        frame: frameIndex('path_stone'),
      });
    } else {
      updateSprite2D(pathSprite, {
        positionPx: [W / 2, pathY],
        sizePx: [W - 2 * margin, 24],
        color: [1, 1, 1, 0.95],
        frame: frameIndex('path_stone'),
      });
    }

    // Header (reference) + prompt.
    headerData = createDefaultTextData(font, headerFont, v.reference, textColor(palette.text), {
      align: 'center',
    });
    headerLayer = createTextLayer(headerData, {
      positionPx: { x: (W - headerData.width) / 2, y: headerY + headerFont * 0.65 },
    });
    addTextRendererLayer(textRenderer, headerLayer);

    // HUD summary (Level, XP, Combo).
    const hudText = isTiny
      ? `Lvl ${gameState.level} • ${gameState.xp} XP • Combos: x${combo}`
      : `Game Stats: Level ${gameState.level} • ${gameState.xp} XP • Session Combos: x${combo}`;
    hudData = createDefaultTextData(font, hudFont, hudText, textColor(palette.text, 0.8), { align: 'center' });
    hudLayer = createTextLayer(hudData, {
      positionPx: { x: (W - hudData.width) / 2, y: hudY + hudFont * 0.65 },
    });
    addTextRendererLayer(textRenderer, hudLayer);

    // Render Majestic Coastal Lighthouses & Radiant Beacons along the path
    const lampCount = queue.length;
    const lampStep = (W - 4 * margin) / Math.max(1, lampCount - 1);
    const activeIndex = Math.max(0, queueIndex - 1);
    for (let i = 0; i < lampCount; i++) {
      const qv = queue[i];
      const isCurrent = i === activeIndex;
      const isSessionLit = sessionLitRefs.has(qv.reference) || i < activeIndex;

      const lx = 2 * margin + i * lampStep;

      // Responsive lighthouse tower dimensions (tall & impressive on desktop!)
      const lw = isMobile ? (isCurrent ? 36 : 28) : (isCurrent ? 52 : 40);
      const lh = isMobile ? (isCurrent ? 72 : 56) : (isCurrent ? 104 : 80);
      const lanternCenterY = pathY - lh + (isMobile ? 12 : 18);

      if (isSessionLit || isCurrent) {
        // Radiant Beacon Light Halo around top lantern room
        const haloSize = isCurrent ? (isMobile ? 84 : 120) : (isMobile ? 64 : 88);
        const haloSprite = addSprite2D(spriteLayer, {
          positionPx: [lx, lanternCenterY],
          sizePx: [haloSize, haloSize],
          color: isCurrent ? [1, 0.85, 0.2, 0.95] : [0.95, 0.75, 0.2, 0.65],
          frame: frameIndex('glow_halo'),
        });
        lampHaloSprites.push(haloSprite);

        // Sweeping Beacon Light Beam extending into the sky
        const beamW = isCurrent ? (isMobile ? 96 : 140) : (isMobile ? 72 : 100);
        const beamH = isCurrent ? (isMobile ? 48 : 70) : (isMobile ? 36 : 50);
        const beamSprite = addSprite2D(spriteLayer, {
          positionPx: [lx + beamW / 2 - 4, lanternCenterY - 4],
          sizePx: [beamW, beamH],
          color: isCurrent ? [1, 0.95, 0.5, 0.9] : [1, 0.85, 0.3, 0.6],
          frame: frameIndex('beacon_beam'),
        });
        beaconBeamSprites.push(beamSprite);
      }

      // Base Coastal Lighthouse Tower Sprite
      const houseFrame = isSessionLit || isCurrent ? frameIndex('lighthouse_lit') : frameIndex('lighthouse_unlit');
      const lhSprite = addSprite2D(spriteLayer, {
        positionPx: [lx, pathY - lh / 2 + 6],
        sizePx: [lw, lh],
        color: [1, 1, 1, 1],
        frame: houseFrame,
      });
      lighthouseSprites.push(lhSprite);
    }

    // Slots: calculate per-word width based on natural text length
    const slotWidths = puzzle.slots.map((s) => {
      const data = createDefaultTextData(font, wordFont, s.word, textColor('#0f172a', 1));
      const w = Math.min(areaW, Math.max(minCellW, data.width + 2 * cellPad));
      disposeDefaultTextData(data);
      return w;
    });
    const slotPos = wrapLayout(slotWidths, areaX, areaW, slotAreaTop, cellH, gap);
    const maxSlotY = slotPos.length > 0 ? Math.max(...slotPos.map((p) => p.y)) : slotAreaTop;
    slotBottomY = maxSlotY + cellH;

    slots = puzzle.slots.map((s, i) => {
      const pos = slotPos[i];
      const w = slotWidths[i];
      const color = s.preFilled
        ? spriteColor(palette.tile, 0.85)
        : spriteColor(palette.slot, 0.6);
      const sprite = addSprite2D(spriteLayer, {
        positionPx: [pos.x + w / 2, pos.y + cellH / 2],
        sizePx: [w, cellH],
        color: [1, 1, 1, 0.95],
        frame: s.preFilled ? frameIndex('tile_bg') : frameIndex('slot_bg'),
      });
      const view: SlotView = {
        index: s.index,
        word: s.word,
        preFilled: s.preFilled,
        x: pos.x,
        y: pos.y,
        w,
        h: cellH,
        sprite,
        borders: [],
      };
      if (s.preFilled) {
        const data = createDefaultTextData(font, wordFont, s.word, textColor('#0f172a', 0.85));
        view.textData = data;
        view.textLayer = createTextLayer(data, {});
        placeText(view.textLayer, data, pos.x, pos.y, w, cellH, wordFont);
        view.textLayer.opacity = 0.85;
        addTextRendererLayer(textRenderer, view.textLayer);
      } else {
        // Outline the blank slot so the drop target is obvious.
        const bcol: [number, number, number, number] = [245 / 255, 158 / 255, 11 / 255, 1];
        for (let b = 0; b < 4; b++) {
          view.borders.push(
            addSprite2D(spriteLayer, { positionPx: [0, 0], sizePx: [1, 1], color: bcol, frame: 0 }),
          );
        }
        placeSlotBorders(view);
      }
      return view;
    });

    // Tiles (bank) — only for tile stages (stage 0 read-along has no bank).
    if (!isStudy) {
      const tileWidths = puzzle.bank.map((t) => {
        const data = createDefaultTextData(font, wordFont, t.display, textColor('#0f172a', 1));
        const w = Math.min(areaW, Math.max(minCellW, data.width + 2 * cellPad));
        disposeDefaultTextData(data);
        return w;
      });

      // On desktop / wide viewports, calculate a constrained bank area to format clickable bank tiles into a centered, square-ish block.
      const { bankAreaX, bankAreaW } = getCompactBankArea(tileWidths, areaW, W, cellH, gap, isMobile);

      // Determine number of wrapped rows for bank tiles within bankAreaW:
      let rowCount = 1;
      let rW = 0;
      for (const w of tileWidths) {
        if (rW > 0 && rW + gap + w > bankAreaW) {
          rowCount++;
          rW = w;
        } else {
          rW += (rW > 0 ? gap : 0) + w;
        }
      }
      const totalBankH = rowCount * cellH + (rowCount - 1) * gap;
      const maxBankBottomY = H - (isMobile ? 48 : 65);
      const idealBankTopY = slotBottomY + (isMobile ? 54 : 64);
      const maxBankTopY = maxBankBottomY - totalBankH;
      bankTopY = Math.min(idealBankTopY, maxBankTopY);
      bankTopY = Math.max(slotBottomY + (isMobile ? 48 : 56), bankTopY);
      const tilePos = wrapLayout(tileWidths, bankAreaX, bankAreaW, bankTopY, cellH, gap);
      tiles = puzzle.bank.map((t, i) => {
        const pos = tilePos[i];
        const w = tileWidths[i];
        const data = createDefaultTextData(font, wordFont, t.display, textColor('#0f172a', 1));
        const textLayer = createTextLayer(data, {});
        const sprite = addSprite2D(spriteLayer, {
          positionPx: [pos.x + w / 2, pos.y + cellH / 2],
          sizePx: [w, cellH],
          color: [1, 1, 1, 1],
          frame: frameIndex('tile_bg'),
        });
        const view: TileView = {
          id: t.id,
          word: t.word,
          display: t.display,
          homeX: pos.x,
          homeY: pos.y,
          curX: pos.x,
          curY: pos.y,
          w,
          h: cellH,
          sprite,
          textLayer,
          textData: data,
          placedSlotIndex: null,
        };
        placeText(textLayer, data, pos.x, pos.y, w, cellH, wordFont);
        addTextRendererLayer(textRenderer, textLayer);
        return view;
      });
    }

    puzzleStartMs = performance.now();
    resolving = false;
  }

  // Re-position everything for the current puzzle on resize.
  function relayout() {
    if (verse) {
      const savedPlaced = tiles.map((t) => ({ id: t.id, slot: t.placedSlotIndex }));
      buildPuzzle(verse);
      for (const p of savedPlaced) {
        if (p.slot == null) continue;
        const t = tiles.find((tt) => tt.id === p.id);
        const s = slots.find((ss) => ss.index === p.slot);
        if (t && s) {
          t.placedSlotIndex = s.index;
          setTilePos(t, s.x, s.y);
        }
      }
    }
  }

  // =========================================================================
  // Input handling.
  // =========================================================================
  let downX = 0;
  let downY = 0;
  let downTilePlacedSlotIndex: number | null = null;

  function animateTileTo(t: TileView, targetX: number, targetY: number, durationMs: number = 140) {
    const startX = t.curX;
    const startY = t.curY;
    const startTime = performance.now();

    function step(now: number) {
      if (disposed) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const ease = 1 - Math.pow(1 - progress, 3);
      const curX = startX + (targetX - startX) * ease;
      const curY = startY + (targetY - startY) * ease;

      setTilePos(t, curX, curY);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setTilePos(t, targetX, targetY);
      }
    }
    requestAnimationFrame(step);
  }

  function getFirstOpenSlot(): SlotView | null {
    for (const s of slots) {
      if (s.preFilled) continue;
      const occupied = tiles.some((t) => t.placedSlotIndex === s.index);
      if (!occupied) return s;
    }
    return null;
  }

  function pointerPos(e: PointerEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }
  function hitTile(x: number, y: number): TileView | null {
    for (let i = tiles.length - 1; i >= 0; i--) {
      const t = tiles[i];
      const tx = t === dragging ? t.homeX : (t.placedSlotIndex != null ? slots[t.placedSlotIndex].x : t.homeX);
      const ty = t === dragging ? t.homeY : (t.placedSlotIndex != null ? slots[t.placedSlotIndex].y : t.homeY);
      if (x >= tx && x <= tx + t.w && y >= ty && y <= ty + t.h) return t;
    }
    return null;
  }
  function hitBlankSlot(x: number, y: number): SlotView | null {
    for (const s of slots) {
      if (s.preFilled) continue;
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
    }
    return null;
  }

  function onPointerDown(e: PointerEvent) {
    if (awaitingRetryTap) {
      // The incorrect-answer banner stays on screen until the player taps;
      // dismiss it now and return the misplaced tiles to the bank for retry.
      awaitingRetryTap = false;
      clearFeedbackBanner();
      returnMisplacedTiles();
      return;
    }
    if (resolving || !puzzle || !verse) return;
    const [x, y] = pointerPos(e);
    const isStudy = puzzle.bank.length === 0; // stage 0 read-along
    if (isStudy) {
      // Stage 0 read-along: any tap resolves.
      resolveTilePuzzle();
      return;
    }
    const t = hitTile(x, y);
    if (!t) return;
    downX = x;
    downY = y;
    downTilePlacedSlotIndex = t.placedSlotIndex;
    dragging = t;
    dragPointerId = e.pointerId;
    dragOffX = x - (t.placedSlotIndex != null ? slots[t.placedSlotIndex].x : t.homeX);
    dragOffY = y - (t.placedSlotIndex != null ? slots[t.placedSlotIndex].y : t.homeY);
    setTilePos(t, x - dragOffX, y - dragOffY);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const [x, y] = pointerPos(e);
    setTilePos(dragging, x - dragOffX, y - dragOffY);
  }
  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    const t = dragging;
    dragging = null;
    dragPointerId = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const [x, y] = pointerPos(e);
    const dist = Math.hypot(x - downX, y - downY);

    if (dist < 8) {
      // Tap / click action:
      if (downTilePlacedSlotIndex == null) {
        // Tap on bank tile: move to first open slot at top
        const openSlot = getFirstOpenSlot();
        if (openSlot) {
          t.placedSlotIndex = openSlot.index;
          animateTileTo(t, openSlot.x, openSlot.y);
          playTileSnapSound();
          if (allFilled()) scheduleResolve();
        } else {
          t.placedSlotIndex = null;
          animateTileTo(t, t.homeX, t.homeY);
          playTileErrorSound();
        }
      } else {
        // Tap on placed slot tile: return back to bank at bottom
        t.placedSlotIndex = null;
        animateTileTo(t, t.homeX, t.homeY);
        playTileErrorSound();
      }
      return;
    }

    // Drag action:
    const slot = hitBlankSlot(x, y);
    if (slot) {
      // Place into the blank slot (evict any tile already there).
      const existing = tiles.find((tt) => tt !== t && tt.placedSlotIndex === slot.index);
      if (existing) {
        existing.placedSlotIndex = null;
        animateTileTo(existing, existing.homeX, existing.homeY);
      }
      t.placedSlotIndex = slot.index;
      animateTileTo(t, slot.x, slot.y);
      playTileSnapSound();
      if (allFilled()) scheduleResolve();
    } else {
      t.placedSlotIndex = null;
      animateTileTo(t, t.homeX, t.homeY);
      playTileErrorSound();
    }
  }

  function allFilled(): boolean {
    if (!puzzle) return false;
    return puzzle.slots.every((s) => s.preFilled || tiles.some((t) => t.placedSlotIndex === s.index));
  }

  // =========================================================================
  // Resolve + advance.
  // =========================================================================
  function scheduleResolve() {
    if (resolving) return;
    resolving = true;
    setTimeout(() => {
      if (disposed) return;
      resolveTilePuzzle();
    }, 350);
  }

  function report(reference: string, correct: boolean, accuracy: number): number {
    const fluent = correct;
    const rating = performanceRating(correct, false, fluent);
    const wordCount = verse ? verse.text.split(' ').length : 10;
    const layer = puzzle ? puzzle.layer : 0;
    const earnedXp = computeXp(layer, wordCount, fluent, combo);
    combo = applyCombo(combo, correct);
    if (correct) {
      if (verse) sessionLitRefs.add(verse.reference);
      playLampLitSound(combo);
      gameState.xp += earnedXp;
      gameState.level = levelForXp(gameState.xp);
      gameState.comboBest = Math.max(gameState.comboBest, combo);
      saveGameState(gameState);
    } else {
      playTileErrorSound();
    }
    onResolve({ reference, correct, accuracy, rating, fluent, usedHint: false, earnedXp });
    return earnedXp;
  }

  function resolveTilePuzzle() {
    if (!verse || !puzzle) return;
    resolving = true;
    const wasStudy = puzzle.layer === 0; // read-along: re-present same verse at next layer
    const placed = puzzle.slots.map((s) => {
      if (s.preFilled) return s.word;
      const t = tiles.find((tt) => tt.placedSlotIndex === s.index);
      return t ? t.word : '';
    });
    const { correct, accuracy } = scoreTilePuzzle(placed, verse.text);
    bumpRecited();
    const earnedXp = report(verse.reference, correct, accuracy);

    // Evaluate each slot individually to provide clear per-word visual feedback
    const slotCorrectness = puzzle.slots.map((s) => {
      if (s.preFilled) return true;
      const t = tiles.find((tt) => tt.placedSlotIndex === s.index);
      if (!t) return false;
      const cleanT = t.word.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanS = s.word.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanT === cleanS;
    });

    const wrongCount = slotCorrectness.filter((ok) => !ok).length;

    // Glow slot borders: Bright green for correct slots, Red for incorrect slots!
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.borders.length === 0) continue;
      const isOk = slotCorrectness[i];
      const col = isOk ? spriteColor('#22c55e', 1) : spriteColor('#ef4444', 1);
      for (const b of s.borders) {
        updateSprite2D(b, { color: col });
      }
      // If tile is placed incorrectly, tint tile with a red error glow
      const t = tiles.find((tt) => tt.placedSlotIndex === s.index);
      if (t && !isOk) {
        updateSprite2D(t.sprite, { color: spriteColor('#fee2e2', 1) });
      }
    }

    // Display clear, instructive feedback banner
    const [W] = canvasSize();
    const bannerMsg = correct
      ? `🔥 Lamp Lit! +${earnedXp} XP (${Math.round(accuracy)}%)`
      : `❌ ${wrongCount} ${wrongCount === 1 ? 'Word' : 'Words'} Misplaced (${Math.round(accuracy)}%) — Tap to retry`;
    const bannerTextColor = textColor('#ffffff', 1);

    if (feedbackLayer) removeTextRendererLayer(textRenderer, feedbackLayer);
    if (feedbackData) disposeDefaultTextData(feedbackData);
    if (feedbackBgSprite) {
      removeSprite2D(feedbackBgSprite);
      feedbackBgSprite = null;
    }

    const { isMobile } = getResponsiveMetrics(W, canvasSize()[1]);
    const feedbackFontSize = isMobile ? 16 : 22;
    feedbackData = createDefaultTextData(font, feedbackFontSize, bannerMsg, bannerTextColor, { align: 'center' });

    // Position toast banner cleanly in the clear space below the last slot row:
    const bannerCenterY = slotBottomY + (isMobile ? 26 : 34);
    const pillW = feedbackData.width + (isMobile ? 28 : 40);
    const pillH = isMobile ? 32 : 38;
    const pillBgCol = correct ? spriteColor('#047857', 0.95) : spriteColor('#b91c1c', 0.95);

    feedbackBgSprite = addSprite2D(spriteLayer, {
      positionPx: [W / 2, bannerCenterY],
      sizePx: [pillW, pillH],
      color: pillBgCol,
      frame: 0,
    });

    feedbackLayer = createTextLayer(feedbackData, {});
    placeText(feedbackLayer, feedbackData, (W - pillW) / 2, bannerCenterY - pillH / 2, pillW, pillH, feedbackFontSize);
    addTextRendererLayer(textRenderer, feedbackLayer);

    if (correct || wasStudy) {
      // Paced 1.4s delay so the player can see and study their slot feedback,
      // then advance to the next puzzle (or re-present the same verse at the
      // next layer for the L0 read-along).
      setTimeout(() => {
        if (disposed) return;
        clearFeedbackBanner();
        if (wasStudy) buildPuzzle(verse);
        else nextPuzzle();
      }, 1400);
    } else {
      // Incorrect: keep the red banner + per-slot glow on screen until the
      // player taps, so they have time to read the feedback before the
      // misplaced tiles return to the word bank.
      lastSlotCorrectness = slotCorrectness;
      awaitingRetryTap = true;
    }
  }

  /** Remove the feedback banner (text + background pill). */
  function clearFeedbackBanner() {
    if (feedbackLayer) {
      removeTextRendererLayer(textRenderer, feedbackLayer);
      feedbackLayer = null;
    }
    if (feedbackData) {
      disposeDefaultTextData(feedbackData);
      feedbackData = null;
    }
    if (feedbackBgSprite) {
      removeSprite2D(feedbackBgSprite);
      feedbackBgSprite = null;
    }
  }

  /**
   * Return only the misplaced tiles to the word bank, reset their slots' borders
   * to the default color, and clear the resolving flag so the player can retry.
   * Uses {@link lastSlotCorrectness} to decide which tiles to move.
   */
  function returnMisplacedTiles() {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.preFilled || lastSlotCorrectness[i]) continue;

      // Reset slot borders to default border color
      for (const b of s.borders) {
        updateSprite2D(b, { color: [245 / 255, 158 / 255, 11 / 255, 1] });
      }

      // Animate misplaced tile smoothly back to its word bank home location
      const t = tiles.find((tt) => tt.placedSlotIndex === s.index);
      if (t) {
        t.placedSlotIndex = null;
        updateSprite2D(t.sprite, { color: [1, 1, 1, 1] });
        animateTileTo(t, t.homeX, t.homeY, 300);
      }
    }
    resolving = false;
  }

  function bumpRecited() {
    if (!verse) return;
    const boot = progressFor(verse.reference);
    const prev = sessionRecited.get(verse.reference) ?? boot?.timesRecited ?? 0;
    sessionRecited.set(verse.reference, prev + 1);
  }

  function nextPuzzle() {
    if (queue.length === 0) {
      // Nothing to practice — show a static message.
      teardownPuzzle();
      const [W] = canvasSize();
      headerData = createDefaultTextData(font, HEADER_FONT, 'No verses available', textColor(palette.text), { align: 'center' });
      headerLayer = createTextLayer(headerData, { positionPx: { x: (W - headerData.width) / 2, y: HEADER_Y } });
      addTextRendererLayer(textRenderer, headerLayer);
      return;
    }

    if (queueIndex >= queue.length) {
      // Fixed 12-lamp session complete! Trigger onSessionComplete callback.
      if (opts.callbacks.onSessionComplete) {
        opts.callbacks.onSessionComplete({
          totalXp: gameState.xp,
          lampsLit: queue.length,
          bestCombo: gameState.comboBest,
        });
      }
      teardownPuzzle();
      const [W] = canvasSize();
      headerData = createDefaultTextData(font, HEADER_FONT, 'Journey Complete! All 12 Lamps Lit!', textColor(palette.accent), { align: 'center' });
      headerLayer = createTextLayer(headerData, { positionPx: { x: (W - headerData.width) / 2, y: HEADER_Y } });
      addTextRendererLayer(textRenderer, headerLayer);

      promptData = createDefaultTextData(font, PROMPT_FONT, 'Tap Play Again for a new journey, or Exit', textColor(palette.text), { align: 'center' });
      promptLayer = createTextLayer(promptData, { positionPx: { x: (W - promptData.width) / 2, y: HEADER_Y + 44 } });
      addTextRendererLayer(textRenderer, promptLayer);
      return;
    }

    const v = queue[queueIndex];
    queueIndex++;
    // A new verse starts at its own auto stage; clear any override that was
    // applied to the previous verse via setStage.
    stageOverride = null;
    ignorePersistedOverride = false;
    buildPuzzle(v);
  }

  // =========================================================================
  // Resize handling.
  // =========================================================================
  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return;
    resizeEngine(engine);
    relayout();
  });
  resizeObserver.observe(canvas);

  // =========================================================================
  // Input listeners.
  // =========================================================================
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  const onUp = (e: PointerEvent) => onPointerUp(e);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  // =========================================================================
  // Boot the render loop + first puzzle.
  // =========================================================================
  await startEngine(engine);
  nextPuzzle();

  // =========================================================================
  // Public handle.
  // =========================================================================
  function setTheme(next: GameTheme) {
    theme = next;
    palette = paletteFor(theme);
    // Rebuild the current puzzle so every sprite/text adopts the new palette.
    const current = verse;
    if (current) buildPuzzle(current);
    else relayout();
  }

  function setStage(stage: ScaffoldLayer | null) {
    if (!verse) return;
    // null = "Auto": revert to the recitation-based stage and ignore any
    // persisted customClozeLevel for this verse. A concrete stage pins it.
    stageOverride = stage;
    ignorePersistedOverride = stage === null;
    buildPuzzle(verse);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    resizeObserver.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    teardownPuzzle();
    unregisterTextRenderer(textRenderer);
    disposeSpriteRenderer(spriteRenderer);
    disposeEngine(engine);
  }

  (window as any).__lampGamePuzzle = () => puzzle;

  return { dispose, setTheme, setStage, getPuzzle: () => puzzle };
}