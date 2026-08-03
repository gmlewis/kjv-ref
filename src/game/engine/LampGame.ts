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
import { getGameLayer, buildTilePuzzle, buildMultiVersePuzzle } from '../scaffold';
import { scoreTilePuzzle, performanceRating, computeXp, applyCombo, levelForXp } from '../scoring';
import { loadGameState, saveGameState } from '../state';
import { playTileSnapSound, playTileErrorSound, playLampLitSound } from './audio';
import type { PerformanceRating } from '../scoring';
import { paletteFor } from './theme';
import type { GameTheme } from './theme';
import { createGameSpriteFrames } from './art';
import { fluencyDurationMs, isFluentNow } from '../fluency';

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
  /** True when the player abandoned this lamp via "Skip" rather than resolving it.
   *  Recorded as a miss (correct:false) through the same host path, but lets the
   *  host reveal the verse and suppress achievement awards. */
  skipped?: boolean;
}

export interface LampGameCallbacks {
  /** Called by the engine each time the player resolves a lamp. */
  onResolve: (result: LampResolveResult) => void;
  /** Called when the active verse (and its scaffold stage) changes so the host
   *  UI can sync state (Peek feature, stage indicator/selector). */
  onVerseChange?: (verse: KJVVerse, stage: ScaffoldLayer, prompt: string) => void;
  /** Called when all lamps in the session queue are lit. */
  onSessionComplete?: (stats: { totalXp: number; lampsLit: number; bestCombo: number }) => void;
  /** Called when the "Skip this lamp" affordance should appear or disappear.
   *  The engine only enables it after the player has struggled (>= SKIP_THRESHOLD
   *  wrong submissions), so it is never present during normal first attempts. */
  onCanSkipChange?: (canSkip: boolean) => void;
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
  /** Abandon the current lamp: records it as a miss (correct:false), reveals
   *  the verse to the host, and advances to the next lamp. No-op if no verse
   *  is loaded or a resolve animation is mid-flight. */
  skipLamp(): void;
  /** Skip the current verse but stay on the same lamp: swap it for a different
   *  random verse from the queue. The skipped verse is moved to the end of the
   *  queue and deferred so it isn't immediately re-chosen next session. No-op
   *  if no verse is loaded, a resolve animation is mid-flight, or the queue
   *  has no other fresh verse to swap in. */
  swapVerse(): void;
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

/** Number of wrong tile-puzzle submissions before the "Skip this lamp" control
 *  is offered. Tuned so the affordance only appears after genuine struggle — it
 *  is never present during normal first/second attempts, eliminating the risk
 *  of an accidental skip while the player is still working. */
const SKIP_THRESHOLD = 2;
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
  (window as any).__lampGameSpriteAtlas = atlas;
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

  // Cosmetic game state (xp / level / combo / deferred refs). Loaded here, at
  // the top of session setup, so the deferred-swap set is available to
  // `selectNextLamps` when the queue is built.
  let gameState = loadGameState();

  let queue: KJVVerse[] = selectNextLamps({
    pool: opts.pool,
    progress: opts.progress,
    due: opts.due,
    dailyGoalCompleted: opts.dailyGoalCompleted,
    deferred: gameState.deferredRefs ?? [],
    limit: 12,
  });
  if (queue.length === 0) queue = opts.pool.slice(0, 12); // fallback: no due, goal done
  let queueIndex = 0;
  // Number of queue positions the currently-displayed lamp occupies. 1 for a
  // single verse; >1 when a stage-5 chain reconstructed multiple consecutive
  // verses as one puzzle. Tracked so the skip-and-swap feature can locate the
  // current verse's span inside the queue.
  let currentChainLen = 1;
  // The chain verses for the currently-displayed lamp (null for a single
  // verse). Retained so relayout / setTheme can rebuild the exact same puzzle
  // (chain included) instead of silently dropping it back to a single verse.
  let currentChainVerses: KJVVerse[] | null = null;
  // Per-verse-random seed fed to the tile-puzzle builder so the word-bank
  // shuffle (and decoy pick) varies between sessions. Stable across
  // relayout / setTheme (same puzzle instance) but re-rolled for each new
  // verse, re-presented read-along, or swapped-in verse.
  let puzzleSeed = 1;

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
  let skyStarSprites: Array<{ sprite: Sprite2DHandle; phase: number; speed: number }> = [];
  let lampSprites: Sprite2DHandle[] = [];
  let lighthouseSprites: Sprite2DHandle[] = [];
  let lampHaloSprites: Sprite2DHandle[] = [];
  let lampFlameSprites: Array<{ sprite: Sprite2DHandle; baseX: number; baseY: number; baseSize: number }> = [];
  let beaconBeamSprites: Array<{ sprite: Sprite2DHandle; baseX: number; baseY: number; phase: number; isCurrent: boolean }> = [];
  let fluencyRingSprite: Sprite2DHandle | null = null;
  let particleSprites: Array<{ sprite: Sprite2DHandle; vx: number; vy: number; life: number; x: number; y: number; r: number; g: number; b: number }> = [];
  let cameraScrollX = 0;
  let targetCameraScrollX = 0;
  let animFrameId: number | null = null;
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

  // --- Skip-this-lamp state ------------------------------------------------
  // Wrong submissions on the current puzzle. Reset in buildPuzzle. When it
  // reaches SKIP_THRESHOLD the host is notified (via onCanSkipChange) that the
  // Skip control may be shown.
  let wrongAttempts = 0;
  // Last value reported to the host via onCanSkipChange, deduped so the host
  // only re-renders on a real change.
  let canSkipNotified = false;
  function setCanSkip(can: boolean) {
    if (can === canSkipNotified) return;
    canSkipNotified = can;
    callbacks.onCanSkipChange?.(can);
  }

  // --- Deferred-verse set (skip-and-swap persistence) ----------------------
  // A verse the player swaps out is recorded here so `selectNextLamps` sorts it
  // last next session ("not now — I'll come back to it later"). Bounded LRU; a
  // verse drops off the front once the set exceeds the cap, and any verse that
  // is actually resolved is removed (the player came back to it).
  const DEFERRED_CAP = 40;
  function deferRef(reference: string) {
    const list = gameState.deferredRefs ? [...gameState.deferredRefs] : [];
    const i = list.indexOf(reference);
    if (i >= 0) list.splice(i, 1); // move-to-back so re-swaps refresh recency
    list.push(reference);
    while (list.length > DEFERRED_CAP) list.shift();
    gameState.deferredRefs = list;
    saveGameState(gameState);
  }
  function undeferRef(reference: string) {
    const list = gameState.deferredRefs ?? [];
    if (list.length === 0) return;
    const i = list.indexOf(reference);
    if (i < 0) return;
    list.splice(i, 1);
    gameState.deferredRefs = list;
    saveGameState(gameState);
  }

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
    // Reserve space on the right edge for the "Skip to a different verse" button.
    // The button sits at right-2 (mobile) or right-3 (desktop) with padding,
    // requiring ~70px exclusion zone on desktop and ~55px on mobile.
    const SKIP_BUTTON_EXCLUSION = isMobile ? 55 : 70;
    const effectiveCanvasW = canvasW - SKIP_BUTTON_EXCLUSION;
    const effectiveMaxAreaW = Math.min(maxAreaW, effectiveCanvasW);

    if (isMobile || tileWidths.length <= 2 || effectiveMaxAreaW <= 520) {
      const bankAreaX = (effectiveCanvasW - effectiveMaxAreaW) / 2;
      return { bankAreaX, bankAreaW: effectiveMaxAreaW };
    }

    const n = tileWidths.length;
    const targetRatio = 1.5; // Target aspect ratio (width / height) for compact near-square desktop bank block
    let bestW = effectiveMaxAreaW;
    let bestDiff = Infinity;

    for (let r = 2; r <= Math.min(n, 6); r++) {
      const itemsPerRow = Math.ceil(n / r);
      let maxRowW = 0;
      for (let i = 0; i < n; i += itemsPerRow) {
        const rowSlice = tileWidths.slice(i, i + itemsPerRow);
        const rw = rowSlice.reduce((acc, w) => acc + w, 0) + Math.max(0, rowSlice.length - 1) * gap;
        if (rw > maxRowW) maxRowW = rw;
      }

      const candidateW = Math.min(effectiveMaxAreaW, maxRowW + 4);
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

      if (diff < bestDiff && candidateW <= effectiveMaxAreaW) {
        bestDiff = diff;
        bestW = candidateW;
      }
    }

    const constrainedW = Math.min(effectiveMaxAreaW, Math.max(360, Math.min(bestW, 680)));
    const bankAreaX = Math.round((effectiveCanvasW - constrainedW) / 2);
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

  /** Create a burst of celebration particles at the given position. */
  function createParticleBurst(x: number, y: number, count: number = 12) {
    const colors = [
      [251, 191, 36], // amber-400
      [254, 240, 138], // amber-200
      [245, 158, 11], // amber-500
      [255, 255, 255], // white
    ];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 30; // upward bias
      const size = 6 + Math.random() * 8;
      const col = colors[Math.floor(Math.random() * colors.length)];
      const sprite = addSprite2D(spriteLayer, {
        positionPx: [x, y],
        sizePx: [size, size],
        color: [col[0] / 255, col[1] / 255, col[2] / 255, 1],
        frame: frameIndex('flame'),
      });
      particleSprites.push({ sprite, vx, vy, life: 1.0, x, y, r: col[0], g: col[1], b: col[2] });
    }
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
    for (const lfs of lampFlameSprites) removeSprite2D(lfs.sprite);
    lampFlameSprites = [];
    for (const bb of beaconBeamSprites) removeSprite2D(bb.sprite);
    beaconBeamSprites = [];
    for (const ss of skyStarSprites) removeSprite2D(ss.sprite);
    skyStarSprites = [];
    for (const p of particleSprites) removeSprite2D(p.sprite);
    particleSprites = [];
    if (fluencyRingSprite) {
      removeSprite2D(fluencyRingSprite);
      fluencyRingSprite = null;
    }
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
    swipeStart = null;
  }

  function buildPuzzle(
    v: KJVVerse,
    chainVerses: KJVVerse[] | null = null,
    minStage: ScaffoldLayer = 0,
  ) {
    teardownPuzzle();
    verse = v;

    // Fresh puzzle → no struggle yet, so the Skip affordance is hidden. This
    // also covers stage overrides / theme swaps which rebuild the puzzle.
    wrongAttempts = 0;
    setCanSkip(false);

    const boot = progressFor(v.reference);
    const timesRecited = sessionRecited.get(v.reference) ?? boot?.timesRecited ?? 0;
    // A live override (from setStage) wins; otherwise the auto stage is computed
    // from this session's recitations + the persisted override + mastered status.
    // When the player chose "Auto" (setStage(null)) the persisted override is
    // deliberately ignored so the verse reverts to a pure recitation-based stage.
    const customForAuto = ignorePersistedOverride ? null : (boot?.customClozeLevel ?? null);
    const computed: ScaffoldLayer =
      stageOverride ?? getGameLayer(timesRecited, customForAuto as any, boot?.status);
    // `minStage` forces the stage up (never down). Used only when re-presenting
    // a verse immediately after its stage-0 read-along: tapping to continue
    // must advance to at least stage 1, even if a persisted customClozeLevel of
    // 0 would otherwise pin the verse back to the read-along and loop forever.
    const stage: ScaffoldLayer = Math.max(minStage, computed) as ScaffoldLayer;

    // Task C-6: Multi-verse chain reconstruction
    puzzle = chainVerses && chainVerses.length > 1
      ? buildMultiVersePuzzle(chainVerses, stage, puzzleSeed, decoyPool)
      : buildTilePuzzle(v, stage, puzzleSeed, decoyPool);

    // The stage instruction is rendered by the host as a DOM row (paired with the
    // stage-control chips), NOT on the canvas, so the chips can sit beside it.
    const isStudy = puzzle.bank.length === 0;
    const promptText = isStudy
      ? (chainVerses && chainVerses.length > 1
          ? `Passage Stage 0 — Read ${chainVerses.length} verses, then tap to continue`
          : 'Verse Stage 0 — Read the verse, then tap to continue')
      : puzzle.decoyCount > 0
        ? (chainVerses && chainVerses.length > 1
            ? `Passage Stage ${puzzle.layer} — Tap the words in order (${puzzle.decoyCount} wrong words mixed in)`
            : `Verse Stage ${puzzle.layer} — Tap the words in order (${puzzle.decoyCount} wrong words mixed in)`)
        : (chainVerses && chainVerses.length > 1
            ? `Passage Stage ${puzzle.layer} — Tap the words in order (${chainVerses.length} verses chained)`
            : `Verse Stage ${puzzle.layer} — Tap the words in order`);
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

    // Dark mode atmospheric vignette (subtle darkness at screen edges)
    if (isDark) {
      // This is handled by CSS on the canvas container for performance
      // The Babylon engine focuses on sprite rendering
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
        const phase = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5; // radians per second
        skyStarSprites.push({
          sprite: addSprite2D(spriteLayer, {
            positionPx: [W * rx, H * ry],
            sizePx: [12, 12],
            color: [1, 1, 1, 0.85],
            frame: frameIndex('star'),
          }),
          phase,
          speed,
        });
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

    // HUD summary (Level, XP, Combo) - captured for updateHud() to refresh.
    const makeHudText = () => isTiny
      ? `Lvl ${gameState.level} • ${gameState.xp} XP • Combos: x${combo}`
      : `Game Stats: Level ${gameState.level} • ${gameState.xp} XP • Session Combos: x${combo}`;
    hudData = createDefaultTextData(font, hudFont, makeHudText(), textColor(palette.text, 0.8), { align: 'center' });
    hudLayer = createTextLayer(hudData, {
      positionPx: { x: (W - hudData.width) / 2, y: hudY + hudFont * 0.65 },
    });
    addTextRendererLayer(textRenderer, hudLayer);

    // Render Majestic Coastal Lighthouses & Radiant Beacons along the path
    // Cap at 12 lighthouses (the session limit) even if queue somehow exceeds it
    const lampCount = Math.min(12, queue.length);
    const lampStep = (W - 4 * margin) / Math.max(1, lampCount - 1);
    const activeIndex = Math.max(0, Math.min(queueIndex - 1, lampCount - 1));
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
        const baseX = lx + beamW / 2 - 4;
        const baseY = lanternCenterY - 4;
        const beamSprite = addSprite2D(spriteLayer, {
          positionPx: [baseX, baseY],
          sizePx: [beamW, beamH],
          color: isCurrent ? [1, 0.95, 0.5, 0.9] : [1, 0.85, 0.3, 0.6],
          frame: frameIndex('beacon_beam'),
        });
        beaconBeamSprites.push({ sprite: beamSprite, baseX, baseY, phase: i * 0.5, isCurrent });
      }

      if (isCurrent) {
        // Task C-5: Fluency Ring Timer around active lighthouse lantern room
        fluencyRingSprite = addSprite2D(spriteLayer, {
          positionPx: [lx, lanternCenterY],
          sizePx: [isMobile ? 64 : 84, isMobile ? 64 : 84],
          color: [1, 0.85, 0.2, 0.95],
          frame: frameIndex('fluency_ring'),
        });
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

      // Add animated flame sprite on top of lit lighthouses
      if (isSessionLit || isCurrent) {
        const flameY = lanternCenterY - 10;
        const flameSize = isMobile ? 14 : 20;
        lampFlameSprites.push({
          sprite: addSprite2D(spriteLayer, {
            positionPx: [lx, flameY],
            sizePx: [flameSize, flameSize],
            color: [1, 0.9, 0.3, 0.9],
            frame: frameIndex('flame'),
          }),
          baseX: lx,
          baseY: flameY,
          baseSize: flameSize,
        });
      }
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
      // Rebuild with the same chain verses so a resize mid-passage doesn't
      // silently collapse a stage-5 chain back to a single verse.
      buildPuzzle(verse, currentChainVerses);
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

    (window as any).__lampGamePuzzle = () => puzzle;
    (window as any).__lampGameCameraScrollX = cameraScrollX;
    (window as any).__lampGameFluencyRing = fluencyRingSprite;
    (window as any).__lampGameParticles = particleSprites;
    (window as any).__lampGameLighthouses = lighthouseSprites;
    (window as any).__lampGameLamps = lampSprites;
  }

  /** Update the HUD text to reflect the current gameState (level, xp, combo). */
  function updateHud() {
    if (!hudLayer || !hudData) return;
    const [W, H] = canvasSize();
    const { isTiny, hudFont, hudY } = getResponsiveMetrics(W, H);
    const hudText = isTiny
      ? `Lvl ${gameState.level} • ${gameState.xp} XP • Combos: x${combo}`
      : `Game Stats: Level ${gameState.level} • ${gameState.xp} XP • Session Combos: x${combo}`;
    // Dispose old text data and create new one
    disposeDefaultTextData(hudData);
    removeTextRendererLayer(textRenderer, hudLayer);
    const newData = createDefaultTextData(font, hudFont, hudText, textColor(palette.text, 0.8), { align: 'center' });
    const newLayer = createTextLayer(newData, {
      positionPx: { x: (W - newData.width) / 2, y: hudY + hudFont * 0.65 },
    });
    addTextRendererLayer(textRenderer, newLayer);
    hudData = newData;
    hudLayer = newLayer;
  }

  function updateParallaxPositions() {
    if (disposed) return;
    const [W, H] = canvasSize();
    const { isMobile, margin } = getResponsiveMetrics(W, H);
    const pathY = isMobile ? H - 84 : H - 64;

    // Distant Mountain Ridge (Parallax Factor 0.2)
    if (mountainSprite) {
      updateSprite2D(mountainSprite, {
        positionPx: [W / 2 - cameraScrollX * 0.2, pathY - 54],
      });
    }

    // Illuminated City on a Hill Citadel Skyline (Parallax Factor 0.35)
    if (citySprite) {
      updateSprite2D(citySprite, {
        positionPx: [W * 0.76 - cameraScrollX * 0.35, pathY - 60],
      });
    }

    // Lush Emerald Forest Hillsides (Parallax Factor 0.5)
    if (forestHillsSprite) {
      updateSprite2D(forestHillsSprite, {
        positionPx: [W / 2 - cameraScrollX * 0.5, pathY - 32],
      });
    }

    // Cascading Waterfall Stream (Parallax Factor 0.5)
    if (waterfallSprite) {
      updateSprite2D(waterfallSprite, {
        positionPx: [W * 0.22 - cameraScrollX * 0.5, pathY - 22],
      });
    }

    // Ocean Water (Parallax Factor 0.8)
    if (oceanWaterSprite) {
      updateSprite2D(oceanWaterSprite, {
        positionPx: [W / 2 - cameraScrollX * 0.8, pathY + 16],
      });
    }

    // Cobblestone Path (Parallax Factor 1.0)
    if (pathSprite) {
      updateSprite2D(pathSprite, {
        positionPx: [W / 2 - cameraScrollX * 1.0, pathY],
      });
    }

    // Coastal Lighthouses & Beacons along the path (Parallax Factor 1.0)
    // Cap at 12 lighthouses (the session limit) even if queue somehow exceeds it
    const lampCount = Math.min(12, queue.length);
    if (lampCount > 0) {
      const lampStep = (W - 4 * margin) / Math.max(1, lampCount - 1);
      const activeIndex = Math.max(0, Math.min(queueIndex - 1, lampCount - 1));

      let haloIdx = 0;
      let beamIdx = 0;

      for (let i = 0; i < lampCount; i++) {
        const isCurrent = i === activeIndex;
        const qv = queue[i];
        const isSessionLit = sessionLitRefs.has(qv.reference) || i < activeIndex;

        const baseLx = 2 * margin + i * lampStep;
        const currentLx = baseLx - cameraScrollX * 1.0;

        const lw = isMobile ? (isCurrent ? 36 : 28) : (isCurrent ? 52 : 40);
        const lh = isMobile ? (isCurrent ? 72 : 56) : (isCurrent ? 104 : 80);
        const lanternCenterY = pathY - lh + (isMobile ? 12 : 18);

        if ((isSessionLit || isCurrent) && haloIdx < lampHaloSprites.length) {
          updateSprite2D(lampHaloSprites[haloIdx++], {
            positionPx: [currentLx, lanternCenterY],
          });
        }

        if ((isSessionLit || isCurrent) && beamIdx < beaconBeamSprites.length) {
          const beamW = isCurrent ? (isMobile ? 96 : 140) : (isMobile ? 72 : 100);
          updateSprite2D(beaconBeamSprites[beamIdx++].sprite, {
            positionPx: [currentLx + beamW / 2 - 4, lanternCenterY - 4],
          });
        }

        if (isCurrent && fluencyRingSprite) {
          updateSprite2D(fluencyRingSprite, {
            positionPx: [currentLx, lanternCenterY],
          });
        }

        if (i < lighthouseSprites.length) {
          updateSprite2D(lighthouseSprites[i], {
            positionPx: [currentLx, pathY - lh / 2 + 6],
          });
        }
      }
    }
  }

  function frameLoop() {
    if (disposed) return;

    // Smooth camera pan between verses (~0.5s transition)
    // Lerp factor 0.025 at 60fps gives ~120 frames = ~0.5s for most of the motion
    if (Math.abs(targetCameraScrollX - cameraScrollX) > 0.5) {
      cameraScrollX += (targetCameraScrollX - cameraScrollX) * 0.025;
      updateParallaxPositions();
      (window as any).__lampGameCameraScrollX = cameraScrollX;
      (window as any).__lampGameLighthouses = lighthouseSprites;
    }

    const now = performance.now();
    const dt = 0.016; // ~60fps

    // Update particle positions and lifetimes
    for (let i = particleSprites.length - 1; i >= 0; i--) {
      const p = particleSprites[i];
      p.life -= dt;
      if (p.life <= 0) {
        removeSprite2D(p.sprite);
        particleSprites.splice(i, 1);
      } else {
        // Apply gravity and velocity
        p.vy += 0.5; // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        updateSprite2D(p.sprite, {
          positionPx: [p.x, p.y],
          color: [p.r / 255, p.g / 255, p.b / 255, p.life],
        });
      }
    }

    // Twinkle stars in dark mode
    for (const star of skyStarSprites) {
      star.phase += star.speed * dt;
      const opacity = 0.4 + 0.6 * Math.sin(star.phase);
      updateSprite2D(star.sprite, {
        color: [1, 1, 1, Math.max(0.1, opacity)],
      });
    }

    // Animate lighthouse flames (flickering)
    const flameTime = now / 1000;
    for (let i = 0; i < lampFlameSprites.length; i++) {
      const flame = lampFlameSprites[i];
      const flicker = 0.8 + 0.2 * Math.sin(flameTime * 8 + i);
      const sway = 0.05 * Math.cos(flameTime * 6 + i * 0.5);
      updateSprite2D(flame.sprite, {
        positionPx: [flame.baseX + sway, flame.baseY],
        color: [1, 0.85 + 0.15 * flicker, 0.3, 0.9],
        sizePx: [flame.baseSize * (0.95 + 0.1 * flicker), flame.baseSize * (0.95 + 0.1 * flicker)],
      });
    }

    // Animate beacon beams (slow sweeping rotation)
    const beamTime = now / 1000;
    for (const beam of beaconBeamSprites) {
      const sweep = Math.sin(beamTime * 0.5 + beam.phase) * (beam.isCurrent ? 15 : 8);
      const alphaPulse = 0.7 + 0.3 * Math.sin(beamTime * 2 + beam.phase);
      const baseColor = beam.isCurrent ? [1, 0.95, 0.5, 0.9] : [1, 0.85, 0.3, 0.6];
      updateSprite2D(beam.sprite, {
        positionPx: [beam.baseX + sweep, beam.baseY],
        color: [baseColor[0], baseColor[1], baseColor[2], baseColor[3] * alphaPulse],
      });
    }

    animFrameId = requestAnimationFrame(frameLoop);
  }

  // =========================================================================
  // Input handling.
  // =========================================================================
  let downX = 0;
  let downY = 0;
  let downTilePlacedSlotIndex: number | null = null;
  // A right-to-left swipe on empty canvas (no tile grabbed) swaps the current
  // verse for a different one without advancing the lamp. Armed on pointerdown
  // that hits no tile; triggered on pointerup if the horizontal travel is a
  // leftward swipe past the threshold. See `swapCurrentVerse`.
  let swipeStart: { x: number; y: number } | null = null;
  const SWIPE_MIN_DX = 60; // px of leftward travel to count as a swap swipe
  const SWIPE_MAX_DY = 50; // px of vertical drift still allowed

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
    if (!t) {
      // Empty-area press on a tile stage: arm a potential right-to-left swap
      // swipe. A plain tap here does nothing (delta stays small), so this only
      // ever fires on an actual leftward swipe.
      swipeStart = { x, y };
      return;
    }
    swipeStart = null;
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
    if (!dragging) {
      // No tile was grabbed — if this was an armed leftward swipe on empty
      // canvas, swap the current verse for a different one (same lamp).
      if (swipeStart) {
        const [x, y] = pointerPos(e);
        const dx = x - swipeStart.x;
        const dy = y - swipeStart.y;
        swipeStart = null;
        // Only a genuine pointer-up (not a pointercancel) can trigger a swap.
        if (e.type === 'pointerup' && dx <= -SWIPE_MIN_DX && Math.abs(dy) <= SWIPE_MAX_DY) {
          swapCurrentVerse();
        }
      }
      return;
    }
    swipeStart = null;
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

  function report(reference: string, correct: boolean, accuracy: number, fluent: boolean): number {
    const rating = performanceRating(correct, false, fluent);
    const wordCount = verse ? verse.text.split(' ').length : 10;
    const layer = puzzle ? puzzle.layer : 0;
    const earnedXp = computeXp(layer, wordCount, fluent, combo);
    combo = applyCombo(combo, correct);
    if (correct) {
      if (verse) sessionLitRefs.add(verse.reference);
      playLampLitSound(combo);
      // Create particle burst at the active lighthouse position
      const [W, H] = canvasSize();
      const { isMobile } = getResponsiveMetrics(W, H);
      const lampCount = queue.length;
      const activeIndex = Math.max(0, queueIndex - 1);
      if (lampCount > 0 && activeIndex < lampCount) {
        const margin = isMobile ? 12 : 24;
        const lampStep = (W - 4 * margin) / Math.max(1, lampCount - 1);
        const lx = 2 * margin + activeIndex * lampStep - cameraScrollX;
        const lh = isMobile ? (activeIndex === queueIndex - 1 ? 72 : 56) : (activeIndex === queueIndex - 1 ? 104 : 80);
        const lanternCenterY = (isMobile ? H - 84 : H - 64) - lh + (isMobile ? 12 : 18);
        createParticleBurst(lx, lanternCenterY, 16 + combo * 2);
      }
      gameState.xp += earnedXp;
      gameState.level = levelForXp(gameState.xp);
      gameState.comboBest = Math.max(gameState.comboBest, combo);
      saveGameState(gameState);
      updateHud(); // Refresh HUD to show new level/XP
    } else {
      playTileErrorSound();
    }
    // The player engaged with this verse (right or wrong), so it's no longer
    // "deferred — try later": drop it from the deferred-swap set so it returns
    // to its normal selection priority next session.
    undeferRef(reference);
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

    // Calculate fluency: did the player finish before the ring depleted?
    const wordCount = verse.text.split(' ').length;
    const durationMs = fluencyDurationMs(wordCount);
    const nowMs = performance.now();
    const fluent = correct && isFluentNow(puzzleStartMs, nowMs, durationMs);

    bumpRecited();
    const earnedXp = report(verse.reference, correct, accuracy, fluent);

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
      // A solved lamp can no longer be skipped; hide the affordance so it
      // can't be tapped during the celebration banner below.
      setCanSkip(false);
      // Paced 1.4s delay so the player can see and study their slot feedback,
      // then advance to the next puzzle (or re-present the same verse at the
      // next layer for the L0 read-along).
      setTimeout(() => {
        if (disposed) return;
        clearFeedbackBanner();
        if (wasStudy) {
          // Re-present the same verse at the next scaffold layer. Force the
          // stage up to at least 1 so a tap on the stage-0 read-along always
          // advances to the word-ordering stage — even when a persisted
          // customClozeLevel of 0 would otherwise pin it back to the read-along
          // and leave the player stuck on "Level 0" forever. A read-along is a
          // one-time intro; after it, the player taps the words in order.
          currentChainLen = 1;
          currentChainVerses = null;
          puzzleSeed = (Math.random() * 2 ** 31) | 0;
          buildPuzzle(verse, null, 1);
        } else {
          nextPuzzle();
        }
      }, 1400);
    } else {
      // Incorrect: keep the red banner + per-slot glow on screen until the
      // player taps, so they have time to read the feedback before the
      // misplaced tiles return to the word bank.
      lastSlotCorrectness = slotCorrectness;
      awaitingRetryTap = true;
      // After enough wrong submissions, offer the Skip affordance. This is the
      // sole trigger — there is no idle/timeout path, so tabbing away never
      // surfaces it.
      wrongAttempts += 1;
      if (wrongAttempts >= SKIP_THRESHOLD) setCanSkip(true);
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

  /** Compute the scaffold stage a verse would be presented at right now, using
   *  the same logic as `buildPuzzle` (live override > persisted override >
   *  mastered > recitation-based). Used to decide chain eligibility without
   *  having to build the puzzle first. */
  function computeStage(v: KJVVerse): ScaffoldLayer {
    const boot = progressFor(v.reference);
    const timesRecited = sessionRecited.get(v.reference) ?? boot?.timesRecited ?? 0;
    const customForAuto = ignorePersistedOverride ? null : (boot?.customClozeLevel ?? null);
    return (stageOverride ?? getGameLayer(timesRecited, customForAuto as any, boot?.status)) as ScaffoldLayer;
  }

  /**
   * Task C-6: Multi-verse chain reconstruction
   * Returns 1-3 consecutive verses to chain together for increased difficulty.
   * Chains only form at stage 5 (hardest difficulty); `effectiveStage` is the
   * actual scaffold stage the verse will be presented at (computed by the
   * caller), NOT `override ?? 5` — previously the fallback made every auto-stage
   * verse pretend to be stage 5, chaining verses even at the stage-0 read-along.
   */
  function getChainVerses(q: KJVVerse[], startIndex: number, effectiveStage: ScaffoldLayer): KJVVerse[] {
    // Only chain at stage 5 (hardest difficulty)
    if (effectiveStage < 5) {
      return [q[startIndex]];
    }

    // Chain 2-3 consecutive verses from the same chapter
    const v1 = q[startIndex];
    if (!v1) return [];

    const [book1, chapter1] = v1.reference.split(':').map(s => s.trim());
    const verseNum1 = parseInt(v1.verse.toString(), 10);

    // Check if next verse is consecutive (same book, same chapter, verse+1)
    const v2 = q[startIndex + 1];
    if (v2) {
      const [book2, chapter2] = v2.reference.split(':').map(s => s.trim());
      const verseNum2 = parseInt(v2.verse.toString(), 10);
      if (book1 === book2 && chapter1 === chapter2 && verseNum2 === verseNum1 + 1) {
        // Check for a third consecutive verse
        const v3 = q[startIndex + 2];
        if (v3) {
          const [book3, chapter3] = v3.reference.split(':').map(s => s.trim());
          const verseNum3 = parseInt(v3.verse.toString(), 10);
          if (book1 === book3 && chapter1 === chapter3 && verseNum3 === verseNum1 + 2) {
            return [v1, v2, v3]; // Chain of 3
          }
        }
        return [v1, v2]; // Chain of 2
      }
    }
    return [v1]; // No consecutive verses found
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

    // A new verse starts at its own auto stage; clear any override that was
    // applied to the previous verse via setStage BEFORE deciding the chain, so
    // chain eligibility reflects the new verse's own auto stage (not the prior
    // verse's override).
    stageOverride = null;
    ignorePersistedOverride = false;

    // Task C-6: Multi-verse chain reconstruction
    // At stage 5, chain 2-3 consecutive verses together for increased difficulty.
    const stage0 = computeStage(queue[queueIndex]);
    const chainVerses = getChainVerses(queue, queueIndex, stage0);
    const v = chainVerses[0];
    queueIndex += chainVerses.length;
    currentChainLen = chainVerses.length;
    currentChainVerses = chainVerses.length > 1 ? chainVerses : null;
    // Fresh per-verse tile-bank seed so the word shuffle varies each session.
    puzzleSeed = (Math.random() * 2 ** 31) | 0;

    // Task C-4: Parallax camera scroll offset tracking verse progression
    const [W, H] = canvasSize();
    const { isMobile } = getResponsiveMetrics(W, H);
    targetCameraScrollX = Math.max(0, (queueIndex - 1) * (isMobile ? 80 : 120));

    buildPuzzle(v, chainVerses.length > 1 ? chainVerses : null);

    // Expose window debug handles for E2E proof assertions
    (window as any).__lampGameSpriteAtlas = atlas;
    (window as any).__lampGameCameraScrollX = cameraScrollX;
    (window as any).__lampGameFluencyRing = fluencyRingSprite;
    (window as any).__lampGameParticles = particleSprites;
    (window as any).__lampGamePuzzle = () => puzzle;
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
  animFrameId = requestAnimationFrame(frameLoop);
  nextPuzzle();

  // =========================================================================
  // Public handle.
  // =========================================================================
  function setTheme(next: GameTheme) {
    theme = next;
    palette = paletteFor(theme);
    // Rebuild the current puzzle so every sprite/text adopts the new palette.
    const current = verse;
    if (current) buildPuzzle(current, currentChainVerses);
    else relayout();
  }

  function setStage(stage: ScaffoldLayer | null) {
    if (!verse) return;
    // null = "Auto": revert to the recitation-based stage and ignore any
    // persisted customClozeLevel for this verse. A concrete stage pins it.
    stageOverride = stage;
    ignorePersistedOverride = stage === null;
    // A manual stage change drops any active chain: the player is explicitly
    // choosing how to practice this single verse.
    currentChainVerses = null;
    currentChainLen = 1;
    buildPuzzle(verse);
  }

  function skipLamp() {
    if (!verse || !puzzle) return;
    // Ignore a skip issued mid auto-resolve animation (the 350ms between
    // all-filled and resolveTilePuzzle). A skip during the "tap to retry"
    // banner is allowed — that's exactly when the player is stuck.
    if (resolving && !awaitingRetryTap) return;

    // Clear the retry banner and return any misplaced tiles so the reveal
    // underneath isn't cluttered.
    if (awaitingRetryTap) {
      awaitingRetryTap = false;
      clearFeedbackBanner();
      returnMisplacedTiles(); // also resets resolving=false
    }
    // Send any other placed tiles back to the bank for a clean slate.
    for (const t of tiles) {
      if (t.placedSlotIndex != null) {
        t.placedSlotIndex = null;
        animateTileTo(t, t.homeX, t.homeY);
      }
    }

    // Counts as a miss: same data path as a wrong resolve. No XP, combo resets,
    // and (via the host's `if (correct)` achievement guard) no awards.
    combo = applyCombo(combo, false);
    gameState.comboBest = Math.max(gameState.comboBest, combo);
    saveGameState(gameState);
    bumpRecited();
    wrongAttempts = 0;
    setCanSkip(false);

    onResolve({
      reference: verse.reference,
      correct: false,
      accuracy: 0,
      rating: performanceRating(false, true, false),
      fluent: false,
      usedHint: true,
      earnedXp: 0,
      skipped: true,
    });

    // Hold the verse on screen briefly so the host's auto-reveal (Peek panel)
    // gives the player a moment to read the answer, then advance.
    resolving = true;
    setTimeout(() => {
      if (disposed) return;
      resolving = false;
      clearFeedbackBanner();
      nextPuzzle();
    }, 1400);
  }

  /**
   * Skip the current verse but STAY on the same lamp: swap the verse currently
   * on screen for a different random verse from the queue, without advancing
   * the journey. The skipped verse is moved to the end of the queue (lowest
   * priority for the rest of this session) and recorded in the deferred set so
   * it isn't immediately re-chosen next session either. Triggered by the
   * circular right-arrow button and by a right-to-left swipe on empty canvas.
   *
   * Unlike `skipLamp`, this does NOT count as a miss, does NOT fire `onResolve`,
   * and does NOT advance `queueIndex` past the current lamp — the replacement
   * verse simply takes the current lamp's place.
   */
  function swapCurrentVerse() {
    if (!verse || !puzzle) return;
    // No swap mid auto-resolve animation or mid-celebration; wait for the
    // current resolve to settle. A swap during the "tap to retry" banner is
    // fine — that's the player giving up on this particular verse.
    if (resolving && !awaitingRetryTap) return;

    if (awaitingRetryTap) {
      awaitingRetryTap = false;
      clearFeedbackBanner();
      returnMisplacedTiles(); // also resets resolving=false
    }

    // The current lamp occupies queue positions [start, start + chainLen - 1].
    const start = queueIndex - currentChainLen;
    const skipRefs = new Set<string>();
    for (let i = start; i < queueIndex; i++) {
      const qv = queue[i];
      if (qv) skipRefs.add(qv.reference);
    }

    // Pick a replacement: prefer an upcoming verse already in the queue (the
    // user asked to swap for "a different random one that exists in the
    // queue"), skipping anything already lit this session or previously
    // deferred (so repeated swaps never bounce back to a verse the player just
    // said "not now" to). Fall back to the full host pool if the queue has no
    // fresh candidates (e.g. last lamp).
    const deferredSet = new Set(gameState.deferredRefs ?? []);
    const isCandidate = (v: KJVVerse) =>
      !skipRefs.has(v.reference) &&
      !sessionLitRefs.has(v.reference) &&
      !deferredSet.has(v.reference);
    let candidates = queue.slice(queueIndex).filter(isCandidate);
    if (candidates.length === 0) candidates = opts.pool.filter(isCandidate);
    if (candidates.length === 0) return; // nothing to swap to — stay put

    const replacement = candidates[Math.floor(Math.random() * candidates.length)];

    // Move the skipped verse(s) to the end of the queue (lowest priority this
    // session) and mark them deferred for next session. The replacement takes
    // the current lamp's position; queueIndex is re-anchored just past it.
    const removed = queue.splice(start, currentChainLen);
    queue.splice(start, 0, replacement);
    for (const v of removed) {
      queue.push(v);
      deferRef(v.reference);
    }
    queueIndex = start + 1;
    currentChainLen = 1;
    currentChainVerses = null;
    stageOverride = null;
    ignorePersistedOverride = false;
    puzzleSeed = (Math.random() * 2 ** 31) | 0;

    // Re-arm a fresh puzzle for the replacement at the current lamp position.
    // The replacement starts at its own auto stage (minStage 0 — a freshly
    // encountered verse may legitimately be a stage-0 read-along).
    buildPuzzle(replacement, null, 0);

    (window as any).__lampGamePuzzle = () => puzzle;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (animFrameId) cancelAnimationFrame(animFrameId);
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

  return { dispose, setTheme, setStage, skipLamp, swapVerse: swapCurrentVerse, getPuzzle: () => puzzle };
}
