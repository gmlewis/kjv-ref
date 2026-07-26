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
import type { ProgressEntry, DueEntry } from '../types';
import { selectNextLamps } from '../selection';
import { getGameLayer, buildTilePuzzle } from '../scaffold';
import { scoreTilePuzzle, performanceRating } from '../scoring';
import { scoreRecall } from '../../utils/practiceHelpers';
import type { PerformanceRating } from '../scoring';
import { paletteFor } from './theme';
import type { GameTheme } from './theme';

/** Result of one lamp resolve, reported to the host so it can write progress. */
export interface LampResolveResult {
  reference: string;
  correct: boolean;
  accuracy: number;
  rating: PerformanceRating;
  fluent: boolean;
  usedHint: boolean;
}

export interface LampGameCallbacks {
  /** Called by the engine each time the player resolves a lamp. The React host
   *  wires this to `useUpdateProgressMutation` + `useUpsertReviewScheduleMutation`
   *  (mirroring `Practice.tsx` `handleComplete`). */
  onResolve: (result: LampResolveResult) => void;
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
const HEADER_Y = 44;
const SLOT_AREA_TOP = 118;
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

  // A 1x1 white atlas; every tile/slot sprite tints it via its `color`.
  const atlas = createSpriteAtlasFromFrames(
    engine,
    [{ pixels: new Uint8Array([255, 255, 255, 255]), width: 1, height: 1, name: 'w' }],
    { srgb: true },
  );
  const spriteLayer: Sprite2DLayer = createSprite2DLayer(atlas, { capacity: 256, depth: 'none' });
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

  // Current puzzle view state.
  let verse: KJVVerse | null = null;
  let puzzle: ReturnType<typeof buildTilePuzzle> | null = null;
  let slots: SlotView[] = [];
  let tiles: TileView[] = [];
  let headerLayer: TextLayer | null = null;
  let headerData: DefaultTextData | null = null;
  let promptLayer: TextLayer | null = null;
  let promptData: DefaultTextData | null = null;
  let typedLayer: TextLayer | null = null;
  let typedData: DefaultTextData | null = null;
  let typedText = '';
  let bgSprite: Sprite2DHandle | null = null;
  let puzzleStartMs = 0;
  let resolving = false;

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

  function wrapLayout(
    widths: number[],
    areaX: number,
    areaW: number,
    startY: number,
    cellH: number,
  ): { x: number; y: number }[] {
    const pos: { x: number; y: number }[] = [];
    let y = startY;
    let row: number[] = [];
    let rowW = 0;
    const flush = () => {
      if (row.length === 0) return;
      const total = row.reduce((s, w, i) => s + widths[row[i]] + (i > 0 ? GAP : 0), 0);
      let x = areaX + Math.max(0, (areaW - total) / 2);
      for (const wi of row) {
        pos[wi] = { x, y };
        x += widths[wi] + GAP;
      }
      y += cellH + GAP;
      row = [];
      rowW = 0;
    };
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];
      if (row.length > 0 && rowW + GAP + w > areaW) flush();
      row.push(i);
      rowW += (row.length > 1 ? GAP : 0) + w;
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
  function placeText(layer: TextLayer, data: DefaultTextData, cellX: number, cellY: number, cellW: number, cellH: number) {
    layer.positionPx = {
      x: cellX + Math.max(0, (cellW - data.width) / 2),
      y: cellY + Math.max(0, (cellH - data.height) / 2),
    };
  }
  function setTilePos(t: TileView, x: number, y: number) {
    placeSprite(t.sprite, x, y, t.w, t.h, spriteColor(palette.tile, 1));
    placeText(t.textLayer, t.textData, x, y, t.w, t.h);
  }
  /** Position the 4 outline quads of a blank slot's drop-target border. */
  function placeSlotBorders(s: SlotView) {
    if (s.borders.length === 0) return;
    const col = spriteColor(palette.slotBorder, 1);
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
    if (typedLayer) {
      removeTextRendererLayer(textRenderer, typedLayer);
      typedLayer = null;
    }
    if (typedData) {
      disposeDefaultTextData(typedData);
      typedData = null;
    }
    slots = [];
    tiles = [];
    puzzle = null;
    verse = null;
    typedText = '';
    dragging = null;
    dragPointerId = null;
  }

  function buildPuzzle(v: KJVVerse) {
    teardownPuzzle();
    verse = v;

    const boot = progressFor(v.reference);
    const timesRecited = sessionRecited.get(v.reference) ?? boot?.timesRecited ?? 0;
    const layer = getGameLayer(timesRecited, (boot?.customClozeLevel ?? null) as any, boot?.status);
    puzzle = buildTilePuzzle(v, layer, queueIndex + 1);

    const [W, H] = canvasSize();
    const areaX = MARGIN;
    const areaW = W - 2 * MARGIN;

    // Header (reference) + prompt.
    headerData = createDefaultTextData(font, HEADER_FONT, v.reference, textColor(palette.text), {
      align: 'center',
    });
    headerLayer = createTextLayer(headerData, { positionPx: { x: (W - headerData.width) / 2, y: HEADER_Y } });
    addTextRendererLayer(textRenderer, headerLayer);

    const isRecall = puzzle.freeRecall;
    const isStudy = puzzle.bank.length === 0 && !puzzle.freeRecall;
    const promptText = isRecall
      ? 'Type the verse, then press Enter'
      : isStudy
        ? 'Read the verse — tap to continue'
        : 'Drag the tiles into the verse';
    promptData = createDefaultTextData(font, PROMPT_FONT, promptText, textColor(palette.accent), {
      align: 'center',
    });
    promptLayer = createTextLayer(promptData, { positionPx: { x: (W - promptData.width) / 2, y: HEADER_Y + 52 } });
    addTextRendererLayer(textRenderer, promptLayer);

    // Slots: a background sprite per slot; pre-filled slots also show their word.
    const slotWidths = puzzle.slots.map((s) => {
      if (!s.preFilled) return MIN_CELL_W;
      const data = createDefaultTextData(font, WORD_FONT, s.word, textColor(palette.text));
      return Math.max(MIN_CELL_W, data.width + 2 * CELL_PAD);
    });
    const slotPos = wrapLayout(slotWidths, areaX, areaW, SLOT_AREA_TOP, CELL_H);
    slots = puzzle.slots.map((s, i) => {
      const pos = slotPos[i];
      const w = slotWidths[i];
      const color = s.preFilled
        ? spriteColor(palette.tile, 0.7)
        : spriteColor(palette.slot, 0.35); // faint fill — the border carries visibility
      const sprite = addSprite2D(spriteLayer, {
        positionPx: [pos.x + w / 2, pos.y + CELL_H / 2],
        sizePx: [w, CELL_H],
        color,
        frame: 0,
      });
      const view: SlotView = { index: s.index, word: s.word, preFilled: s.preFilled, x: pos.x, y: pos.y, w, h: CELL_H, sprite, borders: [] };
      if (s.preFilled) {
        const data = createDefaultTextData(font, WORD_FONT, s.word, textColor(palette.text, 0.6));
        view.textData = data;
        view.textLayer = createTextLayer(data, {});
        placeText(view.textLayer, data, pos.x, pos.y, w, CELL_H);
        view.textLayer.opacity = 0.6;
        addTextRendererLayer(textRenderer, view.textLayer);
      } else {
        // Outline the blank slot so the drop target is obvious.
        const bcol = spriteColor(palette.slotBorder, 1);
        for (let b = 0; b < 4; b++) {
          view.borders.push(
            addSprite2D(spriteLayer, { positionPx: [0, 0], sizePx: [1, 1], color: bcol, frame: 0 }),
          );
        }
        placeSlotBorders(view);
      }
      return view;
    });

    // Tiles (bank) — only for tile modes.
    if (!isRecall && !isStudy) {
      const tileWidths = puzzle.bank.map((t) => {
        const data = createDefaultTextData(font, WORD_FONT, t.display, textColor(palette.text));
        return Math.max(MIN_CELL_W, data.width + 2 * CELL_PAD);
      });
      const bankTop = H - BANK_BOTTOM_PAD - CELL_H;
      const tilePos = wrapLayout(tileWidths, areaX, areaW, bankTop, CELL_H);
      tiles = puzzle.bank.map((t, i) => {
        const pos = tilePos[i];
        const w = tileWidths[i];
        const data = createDefaultTextData(font, WORD_FONT, t.display, textColor(palette.text));
        const textLayer = createTextLayer(data, {});
        const sprite = addSprite2D(spriteLayer, {
          positionPx: [pos.x + w / 2, pos.y + CELL_H / 2],
          sizePx: [w, CELL_H],
          color: spriteColor(palette.tile, 1),
          frame: 0,
        });
        const view: TileView = {
          id: t.id,
          word: t.word,
          display: t.display,
          homeX: pos.x,
          homeY: pos.y,
          w,
          h: CELL_H,
          sprite,
          textLayer,
          textData: data,
          placedSlotIndex: null,
        };
        placeText(textLayer, data, pos.x, pos.y, w, CELL_H);
        addTextRendererLayer(textRenderer, textLayer);
        return view;
      });
    }

    // Free-recall typed-answer layer.
    if (isRecall) {
      typedData = createDefaultTextData(font, TYPED_FONT, ' ', textColor(palette.text), { align: 'center' });
      typedLayer = createTextLayer(typedData, { positionPx: { x: 0, y: SLOT_AREA_TOP + CELL_H + GAP } });
      addTextRendererLayer(textRenderer, typedLayer);
      relayoutTyped();
    }

    puzzleStartMs = performance.now();
    resolving = false;
  }

  function relayoutTyped() {
    if (!typedLayer || !typedData) return;
    const [W] = canvasSize();
    typedLayer.positionPx = { x: (W - typedData.width) / 2, y: SLOT_AREA_TOP + CELL_H + GAP };
  }

  // Re-position everything for the current puzzle on resize.
  function relayout() {
    if (!verse || !puzzle) return;
    const [W, H] = canvasSize();
    const areaX = MARGIN;
    const areaW = W - 2 * MARGIN;

    if (headerLayer && headerData) {
      headerLayer.positionPx = { x: (W - headerData.width) / 2, y: HEADER_Y };
    }
    if (promptLayer && promptData) {
      promptLayer.positionPx = { x: (W - promptData.width) / 2, y: HEADER_Y + 52 };
    }

    const slotWidths = slots.map((s) => s.w);
    const slotPos = wrapLayout(slotWidths, areaX, areaW, SLOT_AREA_TOP, CELL_H);
    slots.forEach((s, i) => {
      const pos = slotPos[i];
      s.x = pos.x; s.y = pos.y;
      const color = s.preFilled ? spriteColor(palette.tile, 0.7) : spriteColor(palette.slot, 0.35);
      placeSprite(s.sprite, s.x, s.y, s.w, s.h, color);
      placeSlotBorders(s);
      if (s.textLayer && s.textData) placeText(s.textLayer, s.textData, s.x, s.y, s.w, s.h);
    });

    if (tiles.length > 0) {
      const tileWidths = tiles.map((t) => t.w);
      const bankTop = H - BANK_BOTTOM_PAD - CELL_H;
      const tilePos = wrapLayout(tileWidths, areaX, areaW, bankTop, CELL_H);
      tiles.forEach((t, i) => {
        t.homeX = tilePos[i].x;
        t.homeY = tilePos[i].y;
        if (t.placedSlotIndex != null) {
          const sv = slots[t.placedSlotIndex];
          setTilePos(t, sv.x, sv.y);
        } else if (t !== dragging) {
          setTilePos(t, t.homeX, t.homeY);
        }
      });
    }
    relayoutTyped();
  }

  // =========================================================================
  // Input handling.
  // =========================================================================
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
    if (resolving || !puzzle || !verse) return;
    const [x, y] = pointerPos(e);
    const isStudy = puzzle.bank.length === 0 && !puzzle.freeRecall;
    if (isStudy) {
      // L0 read-along: any tap resolves.
      resolveTilePuzzle();
      return;
    }
    if (puzzle.freeRecall) return; // keyboard-driven
    const t = hitTile(x, y);
    if (!t) return;
    dragging = t;
    dragPointerId = e.pointerId;
    dragOffX = x - (t.placedSlotIndex != null ? slots[t.placedSlotIndex].x : t.homeX);
    dragOffY = y - (t.placedSlotIndex != null ? slots[t.placedSlotIndex].y : t.homeY);
    if (t.placedSlotIndex != null) t.placedSlotIndex = null; // pick up
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
    const slot = hitBlankSlot(x, y);
    if (slot) {
      // Place into the blank slot (evict any tile already there).
      const existing = tiles.find((tt) => tt !== t && tt.placedSlotIndex === slot.index);
      if (existing) {
        existing.placedSlotIndex = null;
        setTilePos(existing, existing.homeX, existing.homeY);
      }
      t.placedSlotIndex = slot.index;
      setTilePos(t, slot.x, slot.y);
      if (allFilled()) scheduleResolve();
    } else {
      t.placedSlotIndex = null;
      setTilePos(t, t.homeX, t.homeY);
    }
  }

  function allFilled(): boolean {
    if (!puzzle) return false;
    return puzzle.slots.every((s) => s.preFilled || tiles.some((t) => t.placedSlotIndex === s.index));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (resolving || !puzzle || !puzzle.freeRecall || !typedData || !typedLayer) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      resolveRecall();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      typedText = typedText.slice(0, -1);
    } else if (e.key === ' ') {
      e.preventDefault();
      typedText += ' ';
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typedText += e.key;
    } else {
      return;
    }
    updateDefaultTextData(typedData, typedText + '▌');
    relayoutTyped();
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

  function report(reference: string, correct: boolean, accuracy: number) {
    const fluent = correct;
    const rating = performanceRating(correct, false, fluent);
    onResolve({ reference, correct, accuracy, rating, fluent, usedHint: false });
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
    report(verse.reference, correct, accuracy);
    // After reading a new verse once (L0), immediately scaffold it up to L1
    // (drag tiles) instead of skipping to the next verse — otherwise a first-time
    // player taps through the whole queue with no interaction.
    if (wasStudy) buildPuzzle(verse);
    else nextPuzzle();
  }

  function resolveRecall() {
    if (!verse) return;
    resolving = true;
    const pct = scoreRecall(typedText, verse.text);
    bumpRecited();
    report(verse.reference, pct >= 70, pct);
    nextPuzzle();
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
    const v = queue[queueIndex % queue.length];
    queueIndex++;
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
  window.addEventListener('keydown', onKeyDown);

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

  function dispose() {
    if (disposed) return;
    disposed = true;
    resizeObserver.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKeyDown);
    teardownPuzzle();
    unregisterTextRenderer(textRenderer);
    disposeSpriteRenderer(spriteRenderer);
    disposeEngine(engine);
  }

  return { dispose, setTheme };
}