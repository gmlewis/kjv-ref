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
  stopEngine,
  disposeEngine,
  resizeEngine,
  loadFont,
  createDefaultTextData,
  updateDefaultTextData,
  disposeDefaultTextData,
  // These three are aliased as `*Raw` and shadowed below by local wrappers that
  // convert CSS pixels to backing-store pixels. Nothing else in this file may
  // call the raw versions.
  createTextLayer as createTextLayerRaw,
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
  spriteBlendAdditive,
  addSprite2D as addSprite2DRaw,
  updateSprite2D as updateSprite2DRaw,
  removeSprite2D,
} from '@babylonjs/lite';
import type {
  EngineContext,
  Font,
  SpriteRenderer,
  Sprite2DLayer,
  Sprite2DHandle,
  Sprite2DProps,
  TextRenderer,
  TextLayer,
  DefaultTextData,
} from '@babylonjs/lite';
import type { KJVVerse } from '../../data/kjv-verses';
import type { ProgressEntry, DueEntry, TilePuzzle, ScaffoldLayer } from '../types';
import { selectNextLamps, replaceQueueSlot, moveQueueSlot, distinctVerses } from '../selection';
import { getGameLayer, buildTilePuzzle, buildMultiVersePuzzle } from '../scaffold';
import { scoreTilePuzzle, performanceRating, computeXp, applyCombo, levelForXp } from '../scoring';
import { loadGameState, saveGameState } from '../state';
import { playTileSnapSound, playTileErrorSound, playLampLitSound } from './audio';
import type { PerformanceRating } from '../scoring';
import { paletteFor, SCENERY_TEXT_COLORS } from './theme';
import type { GameTheme } from './theme';
import { ART_METRICS, createGameSpriteFrames, TOWER_ASPECT, TOWER_LANTERN_ABOVE_FOOT } from './art';
import { computeGameLayout } from './layout';
import type { GameLayout } from './layout';
import { AMBIENT_INTERVAL_MS, shouldKeepRendering } from './idle';
import { SCENERY_BANDS, SCENERY_BAND_CSS_WIDTH } from './scenery';
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
  /** Called when the cosmetic level / XP / session combo changes, so the host can
   *  render the stats line. The canvas used to draw it as unplated text in the band
   *  directly above the verse, which over the sunset's mid-tones read badly; as DOM
   *  text it can be styled, and — because it is inside the band the host measures —
   *  the verse is now laid out below it rather than behind it. */
  onStatsChange?: (stats: { level: number; xp: number; combo: number }) => void;
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
  /**
   * Tell the engine how tall the DOM chrome above the canvas is, in CSS px.
   *
   * The canvas draws nothing above this line, so the verse's slots can never
   * land underneath the DOM — which is what put the verse behind the Peek card
   * when the engine was guessing the band with a hardcoded 88 px. The host
   * measures the real band with a ResizeObserver and calls this on every change.
   *
   * Re-lays out the current puzzle (a full rebuild, restoring placed tiles) and
   * ignores changes under 2 px, so observer jitter cannot thrash the scene.
   */
  setTopInset(px: number): void;
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

/**
 * The lamp row's tower geometry, shared by every site that needs to know where
 * a lamp's lantern actually is — the row itself in `buildPuzzle` and the
 * completion particle burst in `resolveCurrent`. Only a tower's *height* is
 * chosen here; its width is derived from `TOWER_ASPECT` so the art is never
 * stretched off its authored shape.
 *
 * This used to be duplicated: the burst had its own (72/56) heights and its own
 * lantern offset, which drifted further from the row every time the towers were
 * repainted, until the particles lit up empty sky beside the tower they were
 * supposed to be celebrating.
 */
const TOWER_H = {
  mobile: { current: 96, lit: 78, unlit: 74 },
  desktop: { current: 144, lit: 117, unlit: 111 },
} as const;

/** The tower's foot sits this far below `pathY`, so it stands in the causeway. */
const TOWER_FOOT_BELOW_PATH = 6;

/**
 * Total horizontal camera travel across one session, in CSS px — the "scroll
 * gently as you advance" of PracticeModeGameIdeas.md, spread over the whole
 * journey (~11px per lamp on desktop) rather than a fixed jolt per verse.
 *
 * Every parallax layer is drawn this much wider than the canvas on each side,
 * so a layer can never expose a gap at an edge no matter where the camera sits:
 * the layer spans [center - W/2 - PAN, center + W/2 + PAN] and the camera can
 * only offset it by at most PAN.
 *
 * The 12 lighthouses are deliberately NOT scrolled — they are the session's
 * progress board and have to stay on screen, lit left-to-right. Dragging them
 * along with the camera (and with a per-verse step larger than their spacing)
 * was what pushed most of the row off the left edge and left the right half of
 * the screen empty.
 */
const PARALLAX_PAN_DESKTOP = 120;
const PARALLAX_PAN_MOBILE = 80;

/**
 * Upper bound on the backing-store-to-CSS-pixel ratio the canvas renders at.
 *
 * The engine used to be created with `maxDevicePixelRatio: 1`, which made the
 * backing store exactly the CSS-pixel size — that is why every coordinate in
 * this file can be written in CSS pixels. On a phone at DPR 2.62 the canvas was
 * then upscaled 2.62x by the compositor, which is why the art read as soft.
 * Rendering at the device's real ratio makes the glyphs and edges crisp; the cap
 * keeps a DPR-4 desktop from allocating a 4x surface for no visible gain.
 */
const RENDER_SCALE_CAP = 3;

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

  // Sprites are single-sampled whatever this says, so the only render target
  // MSAA multiplies is the text pass; glyph coverage is analytic in the shader,
  // so 1 costs nothing visually and saves 4x on that pass.
  const engine: EngineContext = await createEngine(canvas, {
    maxDevicePixelRatio: RENDER_SCALE_CAP,
    msaaSamples: 1,
  });
  const font: Font = await loadFont(`${import.meta.env.BASE_URL}fonts/Inter.ttf`);

  let theme: GameTheme = opts.theme;
  let palette = paletteFor(theme);
  let disposed = false;

  // Vector art atlas generated from art.ts frames.
  const spriteFrames = createGameSpriteFrames();
  const frameMap = new Map<string, number>(spriteFrames.map((f, i) => [f.name, i]));
  const frameIndex = (name: string): number => {
    const index = frameMap.get(name);
    // Not `?? 0`: frame 0 is the 1x1 white pixel, so a typo here used to draw a
    // plain white quad somewhere in the scene instead of failing. The name
    // inventory is asserted in art.test.ts; this is the backstop.
    if (index === undefined) throw new Error(`Unknown sprite frame: ${name}`);
    return index;
  };

  // The atlas is shelf-packed left-to-right and a frame *wider* than the shelf
  // cannot be placed at all — the packer throws. Its default shelf is 1024 px and
  // the scenery bands are authored at device density (~1624 px on the reference
  // phone), so the default would fail at boot. Derive the shelf from the frames
  // themselves so it can never drift behind the art again.
  const widestFramePx = spriteFrames.reduce((w, f) => Math.max(w, f.width), 1);
  const atlas = createSpriteAtlasFromFrames(engine, spriteFrames, {
    srgb: true,
    maxWidthPx: Math.max(2048, widestFramePx + 16),
  });
  (window as any).__lampGameSpriteAtlas = atlas;
  const spriteLayer: Sprite2DLayer = createSprite2DLayer(atlas, { capacity: 512, depth: 'none' });
  // The additive layer: halos, beacon beams, flames, the pools and reflections on
  // the causeway, and the celebration particles. They are painted with `order: 1`
  // so they draw after the base layer, and additively so light *stacks* instead
  // of replacing what is behind it — that is what makes twelve reflections merge
  // into the glow along the whole waterline.
  const glowLayer: Sprite2DLayer = createSprite2DLayer(atlas, {
    capacity: 192,
    depth: 'none',
    order: 1,
    blendMode: spriteBlendAdditive,
  });
  const spriteRenderer: SpriteRenderer = createSpriteRenderer(engine, {
    layers: [spriteLayer, glowLayer],
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
  // Belt and braces: `selectNextLamps` fills the session from the pool whenever
  // the pool can supply a row of lamps, so only an empty pool reaches this.
  if (queue.length === 0) queue = opts.pool.slice(0, 12);
  // Hard session invariant: the 12 lamps are 12 DISTINCT verses. `selectNextLamps`
  // already returns distinct verses; this also covers any repeat a custom road
  // pool might carry, so a verse can never occupy two lamps.
  queue = distinctVerses(queue).slice(0, 12);
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
  // No `hudLayer`/`hudData`: the Level/XP/Combo line is DOM text now, held by the
  // host in React state — see `publishStats`.
  let feedbackLayer: TextLayer | null = null;
  let feedbackData: DefaultTextData | null = null;
  let feedbackBgSprite: Sprite2DHandle | null = null;
  let slotBottomY = 220;
  let bankTopY = 500;
  // The four scenery bands. `sky` covers the canvas and never pans; the other three
  // are the far shore, the water and the causeway, and they pan by their own factors
  // (`SCENERY_BANDS`). Their vertical placement is anchored to `pathY`, so a taller
  // canvas shows more water rather than moving the road.
  let skySprite: Sprite2DHandle | null = null;
  let farSprite: Sprite2DHandle | null = null;
  let midSprite: Sprite2DHandle | null = null;
  let nearSprite: Sprite2DHandle | null = null;
  let lighthouseSprites: Sprite2DHandle[] = [];
  let lampHaloSprites: Sprite2DHandle[] = [];
  // The shadow a tower casts on the causeway, the pool a lit lamp throws on it, and
  // the reflection below it. All three are per-lamp (they do not pan), so they are
  // sprites rather than part of the bands.
  let lampShadowSprites: Sprite2DHandle[] = [];
  let lampPoolSprites: Sprite2DHandle[] = [];
  let lampReflectSprites: Array<{ sprite: Sprite2DHandle; baseX: number; baseY: number; baseH: number; phase: number }> = [];
  let lampFlameSprites: Array<{ sprite: Sprite2DHandle; baseX: number; baseY: number; baseSize: number }> = [];
  // `rotation` pivots about the sprite's centre, and the beam's apex is the bottom
  // centre of its frame — so the centre is derived from the apex per frame.
  // `apexX`/`apexY` are where the beam's light comes from (the lantern); `h` is the
  // frame's height and `restSweep` the angle it rests at. The engine animates the
  // angle and re-derives the box centre from the apex, because `rotation` pivots
  // about the centre while the art's apex is at the bottom centre of the frame.
  let beaconBeamSprites: Array<{ sprite: Sprite2DHandle; apexX: number; apexY: number; h: number; phase: number; isCurrent: boolean; restSweep: number }> = [];
  let fluencyRingSprite: Sprite2DHandle | null = null;
  let particleSprites: Array<{ sprite: Sprite2DHandle; vx: number; vy: number; life: number; x: number; y: number; r: number; g: number; b: number }> = [];
  let cameraScrollX = 0;
  let targetCameraScrollX = 0;
  let animFrameId: number | null = null;

  // --- Render-loop idling --------------------------------------------------
  // See `idle.ts` for the policy. These are its inputs and outputs: the loop is
  // ours (`requestAnimationFrame`), but the frames are the engine's, so idling
  // means `stopEngine` — the Lite loop re-arms itself unconditionally and has no
  // dirty check, so a paused scene still costs a full-screen render at native
  // density every frame unless the engine itself is stopped.
  let loopRunning = false;
  let engineRunning = false;
  /** `performance.now()` of the last visual mutation, i.e. the last `wake()`. */
  let lastActivityAt = performance.now();
  /** `performance.now()` of the last ambient sprite update (the 30 fps cadence). */
  let lastAmbientAt = 0;
  /** `performance.now()` of the previous `runFrame`, for the real particle delta. */
  let lastFrameAt = performance.now();
  /**
   * True while this module is inside `frameLoop`. Mutations made *by* the loop
   * (the camera lerp, the ambient pulse) must not count as player activity, or
   * the scene could never settle.
   */
  let inFrameLoop = false;
  /** True while the tab is hidden: nothing is drawn and nothing is animated. */
  let hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

  const sessionLitRefs = new Set<string>();
  // Verses the player skipped (right-arrow / swipe) during THIS session. A skip
  // means "not now" for the rest of this game, so these are never re-presented
  // and never re-picked as a swap replacement. Cleared implicitly on the next
  // session (a fresh engine instance).
  const sessionSkippedRefs = new Set<string>();
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

  // =========================================================================
  // CSS pixels -> backing-store pixels.
  //
  // Every sprite position/size and every text layer anchor is interpreted by the
  // engine in *backing-store* pixels: the sprite vertex shader divides
  // `positionPx` by the render target's size, and the text MVP is built as
  // `2*scale/targetWidth` — both of which are `canvas.width`/`canvas.height`.
  // With the old `maxDevicePixelRatio: 1` those two were the same number as the
  // CSS size, which is why the whole file could be written in CSS pixels. Now
  // that the surface renders at the device's real ratio, `dpr` is the only
  // difference between the two, and every value handed to the engine is scaled
  // at the choke points below.
  //
  // Layout maths stay in CSS pixels everywhere — including pointer hit-testing,
  // which measures with getBoundingClientRect() — so nothing outside this block
  // has to know the ratio exists.
  // =========================================================================

  /** Backing-store pixels per CSS pixel, as the surface actually sized itself. */
  function surfaceScale(): number {
    const cssW = canvas.clientWidth || 0;
    const storeW = canvas.width || 0;
    if (cssW <= 0 || storeW <= 0) return 1;
    const scale = storeW / cssW;
    return Number.isFinite(scale) && scale > 0 ? Math.min(scale, 4) : 1;
  }

  let dpr = 1;

  /**
   * The measured bottom edge of the DOM chrome, in CSS px, as reported by the
   * host through `setTopInset`. 0 means "not measured yet", which `layout.ts`
   * turns into its historical fallback so a boot-time layout is unchanged.
   */
  let topInset = 0;

  /** CSS px -> backing-store px. */
  const S = (v: number): number => v * dpr;

  function addSprite2D(layer: Sprite2DLayer, props: Sprite2DProps): Sprite2DHandle {
    // Every visual mutation in this file funnels through these wrappers (the
    // `*Raw` versions are shadowed), so waking here — rather than at each of the
    // ~60 call sites — is what makes a stopped engine safe: nothing can be drawn
    // into the scene without a frame being scheduled to show it.
    wake();
    return addSprite2DRaw(layer, {
      ...props,
      positionPx: [S(props.positionPx[0]), S(props.positionPx[1])],
      ...(props.sizePx ? { sizePx: [S(props.sizePx[0]), S(props.sizePx[1])] } : {}),
    });
  }

  function updateSprite2D(sprite: Sprite2DHandle, patch: Partial<Sprite2DProps>): void {
    wake();
    const scaled: Partial<Sprite2DProps> = { ...patch };
    if (patch.positionPx) scaled.positionPx = [S(patch.positionPx[0]), S(patch.positionPx[1])];
    if (patch.sizePx) scaled.sizePx = [S(patch.sizePx[0]), S(patch.sizePx[1])];
    updateSprite2DRaw(sprite, scaled);
  }

  /** The additive-layer counterparts of the two above. Same CSS-px contract. */
  function addGlowSprite(props: Sprite2DProps): Sprite2DHandle {
    return addSprite2D(glowLayer, props);
  }

  /**
   * Create a text layer anchored at a CSS-pixel point.
   *
   * The glyphs come from an analytic curve shader rather than a glyph bitmap, so
   * `scale: dpr` renders true vector coverage at the surface's resolution — the
   * crispness win — while `data.width` stays in CSS pixels and every existing
   * layout calculation keeps working unchanged.
   */
  function createTextLayer(data: DefaultTextData, x: number = 0, y: number = 0): TextLayer {
    wake();
    const layer = createTextLayerRaw(data, { positionPx: { x: S(x), y: S(y) } });
    layer.scale = dpr;
    return layer;
  }

  /**
   * The vertical stack, from `layout.ts` — pure arithmetic, unit tested there.
   *
   * `topInset` is the measured bottom edge of the DOM chrome above the canvas,
   * pushed in by the host through `setTopInset`. Until it arrives (0), the layout
   * uses its historical fallback, so a boot-time layout is unchanged.
   */
  function getResponsiveMetrics(W: number, H: number): GameLayout {
    return computeGameLayout(W, H, topInset);
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
    wake();
    layer.positionPx = {
      x: S(cellX + Math.max(0, (cellW - data.width) / 2)),
      y: S(baselineY),
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
      const sprite = addGlowSprite({
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
    for (const lhs of lighthouseSprites) removeSprite2D(lhs);
    lighthouseSprites = [];
    for (const lhs of lampHaloSprites) removeSprite2D(lhs);
    lampHaloSprites = [];
    for (const s of lampShadowSprites) removeSprite2D(s);
    lampShadowSprites = [];
    for (const s of lampPoolSprites) removeSprite2D(s);
    lampPoolSprites = [];
    for (const r of lampReflectSprites) removeSprite2D(r.sprite);
    lampReflectSprites = [];
    for (const lfs of lampFlameSprites) removeSprite2D(lfs.sprite);
    lampFlameSprites = [];
    for (const bb of beaconBeamSprites) removeSprite2D(bb.sprite);
    beaconBeamSprites = [];
    for (const p of particleSprites) removeSprite2D(p.sprite);
    particleSprites = [];
    if (fluencyRingSprite) {
      removeSprite2D(fluencyRingSprite);
      fluencyRingSprite = null;
    }
    for (const [sprite, clear] of [
      [skySprite, () => { skySprite = null; }],
      [farSprite, () => { farSprite = null; }],
      [midSprite, () => { midSprite = null; }],
      [nearSprite, () => { nearSprite = null; }],
    ] as const) {
      if (!sprite) continue;
      removeSprite2D(sprite);
      clear();
    }
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
    explicitStage?: ScaffoldLayer,
  ) {
    wake();
    // The surface is resized before a rebuild (ResizeObserver -> resizeEngine ->
    // relayout), so this is the one place the ratio can change. Read it after the
    // resize and before any sprite or text layer is created.
    dpr = surfaceScale();
    teardownPuzzle();
    verse = v;

    // Fresh puzzle → no struggle yet, so the Skip affordance is hidden. This
    // also covers stage overrides / theme swaps which rebuild the puzzle.
    wrongAttempts = 0;
    setCanSkip(false);

    let stage: ScaffoldLayer;
    if (explicitStage !== undefined) {
      stage = explicitStage;
    } else {
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
      stage = Math.max(minStage, computed) as ScaffoldLayer;
    }

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
      cellH,
      minCellW,
      cellPad,
      gap,
      slotAreaTop,
      pathY,
    } = getResponsiveMetrics(W, H);
    // `headerY`/`hudY`/`hudFont` are deliberately not taken here: both text lines
    // that used them are DOM now, and the layout still reserves their band (see
    // `layout.ts`, which owns those numbers) — the canvas simply draws nothing in it.

    const areaX = margin;
    const areaW = W - 2 * margin;

    // One sunset for both themes: there is no `isDark` branch in the scenery any
    // more, and the palette above is what colours the text and the cards.

    // Parallax layers are drawn wider than the canvas so the camera pan (which is
    // bounded by PARALLAX_PAN) can never pull an edge into view. See the
    // PARALLAX_PAN_* comment.
    //
    // The bands are authored at `SCENERY_BAND_CSS_WIDTH`, which on a phone is
    // already wider than the canvas plus the pan — so this takes the larger of
    // the two rather than re-deriving the width from the pan. Deriving it would
    // draw the 620-px-wide art 572 px wide, an 8% horizontal squeeze that walks
    // the sun and the citadel off the positions they were approved at. On a
    // desktop canvas the pan does win, and the bands stretch horizontally; that
    // is the known limitation of authoring one band set for the phone.
    const pan = isMobile ? PARALLAX_PAN_MOBILE : PARALLAX_PAN_DESKTOP;
    const layerW = Math.max(W + 2 * (pan + 24), SCENERY_BAND_CSS_WIDTH);

    // ---------------------------------------------------------------------
    // The scene: the sunset sky, then three parallax bands (far shore, water,
    // causeway). Every band's vertical placement is derived from `pathY` and
    // its extents come from `SCENERY_BANDS`, so the art and the placement
    // cannot disagree about where the ridge or the shoreline is.
    //
    // The bands pan; the sky does not. `updateParallaxPositions` owns the
    // horizontal placement — this block only has to get them on screen so the
    // first frame is right.
    // ---------------------------------------------------------------------
    const bandBox = (top: number, height: number) => ({
      positionPx: [W / 2, top + height / 2] as [number, number],
      sizePx: [layerW, height] as [number, number],
    });

    if (!skySprite) {
      skySprite = addSprite2D(spriteLayer, {
        positionPx: [W / 2, H / 2],
        sizePx: [W, H],
        color: [1, 1, 1, 1],
        frame: frameIndex('sky'),
      });
    } else {
      updateSprite2D(skySprite, {
        positionPx: [W / 2, H / 2],
        sizePx: [W, H],
        color: [1, 1, 1, 1],
        frame: frameIndex('sky'),
      });
    }

    // Far shore: ridge, woodland, waterfall and citadel, baked as one picture.
    const farTop = pathY + SCENERY_BANDS.far.top;
    const farH = SCENERY_BANDS.far.bottom - SCENERY_BANDS.far.top;
    const farBox = bandBox(farTop, farH);
    if (!farSprite) {
      farSprite = addSprite2D(spriteLayer, {
        ...farBox,
        color: [1, 1, 1, 1],
        frame: frameIndex('scenery_far'),
      });
    } else {
      updateSprite2D(farSprite, { ...farBox, frame: frameIndex('scenery_far') });
    }

    // Water, from the shoreline to whatever the bottom of the canvas is. The
    // frame is authored for 86 CSS px; stretching it to the live height is how
    // a taller canvas shows more water instead of raw sky below the waves.
    const midTop = pathY + SCENERY_BANDS.mid.top;
    const midBox = bandBox(midTop, H - midTop);
    if (!midSprite) {
      midSprite = addSprite2D(spriteLayer, {
        ...midBox,
        color: [1, 1, 1, 1],
        frame: frameIndex('scenery_mid'),
      });
    } else {
      updateSprite2D(midSprite, { ...midBox, frame: frameIndex('scenery_mid') });
    }

    // The causeway itself, on the ground plane. It overhangs the water by 2 px,
    // which is what hides the seam between the two bands.
    const nearTop = pathY + SCENERY_BANDS.near.top;
    const nearH = SCENERY_BANDS.near.bottom - SCENERY_BANDS.near.top;
    const nearBox = bandBox(nearTop, nearH);
    if (!nearSprite) {
      nearSprite = addSprite2D(spriteLayer, {
        ...nearBox,
        color: [1, 1, 1, 1],
        frame: frameIndex('scenery_near'),
      });
    } else {
      updateSprite2D(nearSprite, { ...nearBox, frame: frameIndex('scenery_near') });
    }

    // The verse's reference and the Level/XP/Combo stats line are NOT drawn here.
    // They are DOM text now (see `onStatsChange` and the host's prompt column):
    // canvas text has no background plate, and over the sunset these two lines sit
    // in the band directly above the verse, where unplated low-contrast glyphs made
    // the whole top of the puzzle hard to read. Moving them out also lets the host
    // measure them, so the band the canvas must stay below includes them.
    publishStats();

    // Render Majestic Coastal Lighthouses & Radiant Beacons along the path
    // Cap at 12 lighthouses (the session limit) even if queue somehow exceeds it
    const lampCount = Math.min(12, queue.length);
    const lampStep = (W - 4 * margin) / Math.max(1, lampCount - 1);
    const activeIndex = Math.max(0, Math.min(queueIndex - 1, lampCount - 1));
    // The tower's foot, and the three heights it can be drawn at. Only the
    // *height* is chosen here — the width is derived from it through
    // `TOWER_ASPECT`, so the frame is never stretched off its authored shape.
    const footY = pathY + TOWER_FOOT_BELOW_PATH;
    const towerH = isMobile ? TOWER_H.mobile : TOWER_H.desktop;
    for (let i = 0; i < lampCount; i++) {
      const qv = queue[i];
      const isCurrent = i === activeIndex;
      const isSessionLit = sessionLitRefs.has(qv.reference) || i < activeIndex;
      const lit = isSessionLit || isCurrent;

      const lx = 2 * margin + i * lampStep;
      const lh = isCurrent ? towerH.current : lit ? towerH.lit : towerH.unlit;
      const lw = lh * TOWER_ASPECT;
      // The light is the only thing tying these separate sprites together: the
      // halo, the flame, the ring and the beam's pivot all belong on the lantern
      // room, which the frame draws at a fixed fraction of its own height.
      const lanternCenterY = footY - TOWER_LANTERN_ABOVE_FOOT * lh;

      // The tower's contact shadow, on the causeway under its foot. Without it
      // the towers sit *on* the road rather than *in* it.
      lampShadowSprites.push(addSprite2D(spriteLayer, {
        positionPx: [lx, footY + 0.5],
        sizePx: [lw * 2, 7],
        color: [1, 1, 1, 0.9],
        frame: frameIndex('lamp_shadow'),
      }));

      if (lit) {
        // Radiant Beacon Light Halo around top lantern room
        const haloSize = isCurrent ? 116 : 80;
        lampHaloSprites.push(addGlowSprite({
          positionPx: [lx, lanternCenterY],
          sizePx: [haloSize, haloSize],
          color: isCurrent ? [1, 0.85, 0.2, 0.95] : [0.95, 0.75, 0.2, 0.65],
          frame: frameIndex('glow_halo'),
        }));

        // Sweeping Beacon Light Beam extending into the sky. The frame's apex is
        // the bottom centre of its box and `rotation` pivots about that box's
        // centre, so the centre is placed where rotating the apex onto the lantern
        // puts it. (Negated: the engine's positive angle is counter-clockwise on
        // screen, the art was approved with the opposite sign.)
        const beamW = isCurrent ? 132 : 104;
        const beamH = isCurrent ? 80 : 62;
        const sweep = (i % 2 === 0 ? -1 : 1) * (isCurrent ? 0.3 : 0.2);
        const apexX = lx;
        const apexY = lanternCenterY - 4;
        const centreX = apexX + Math.sin(sweep) * (beamH / 2);
        const centreY = apexY - Math.cos(sweep) * (beamH / 2);
        beaconBeamSprites.push({
          sprite: addGlowSprite({
            positionPx: [centreX, centreY],
            sizePx: [beamW, beamH],
            rotation: -sweep,
            color: isCurrent ? [1, 0.95, 0.5, 0.9] : [1, 0.85, 0.3, 0.6],
            frame: frameIndex('beacon_beam'),
          }),
          apexX,
          apexY,
          h: beamH,
          phase: i * 0.5,
          isCurrent,
          restSweep: sweep,
        });
      }

      if (isCurrent) {
        // Task C-5: Fluency Ring Timer around active lighthouse lantern room.
        // On the additive layer: it is light, and it has to read *through* the
        // halo behind it rather than being dimmed by it.
        fluencyRingSprite = addGlowSprite({
          positionPx: [lx, lanternCenterY],
          sizePx: [isMobile ? 64 : 84, isMobile ? 64 : 84],
          color: [1, 0.85, 0.2, 0.95],
          frame: frameIndex('fluency_ring'),
        });
      }

      // Base Coastal Lighthouse Tower Sprite
      const houseFrame = lit ? frameIndex('lighthouse_lit') : frameIndex('lighthouse_unlit');
      const lhSprite = addSprite2D(spriteLayer, {
        positionPx: [lx, footY - lh / 2],
        sizePx: [lw, lh],
        color: [1, 1, 1, 1],
        frame: houseFrame,
      });
      lighthouseSprites.push(lhSprite);

      if (lit) {
        // The flame sits *inside* the lantern glass, which the frame draws at 10%
        // of the tower's height — hence the size, and hence centring it on the
        // lantern rather than floating it above.
        const flameSize = lh * 0.1;
        lampFlameSprites.push({
          sprite: addGlowSprite({
            positionPx: [lx, lanternCenterY],
            sizePx: [flameSize, flameSize],
            color: [1, 0.9, 0.3, 0.9],
            frame: frameIndex('flame'),
          }),
          baseX: lx,
          baseY: lanternCenterY,
          baseSize: flameSize,
        });

        // The warm pool the lamp throws on the causeway, and its reflection in
        // the water below. Twelve of these merging along the waterline is what
        // the shore glow in the approved study actually is.
        lampPoolSprites.push(addGlowSprite({
          positionPx: [lx, pathY + 14],
          sizePx: [88, 22],
          color: [1, 1, 1, 0.22 * 0.85],
          frame: frameIndex('lamp_pool'),
        }));

        const reflectTop = pathY + 16;
        lampReflectSprites.push({
          sprite: addGlowSprite({
            positionPx: [lx, (reflectTop + H) / 2],
            sizePx: [28, H - reflectTop],
            color: [1, 1, 1, 0.24 * 0.85],
            frame: frameIndex('lamp_reflection'),
          }),
          baseX: lx,
          baseY: (reflectTop + H) / 2,
          baseH: H - reflectTop,
          phase: i * 0.7,
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
      // The plate tints itself: `tile_bg`/`slot_bg` carry the cream (or amber)
      // face and the gold rules in their own pixels. A `color` tint here would
      // multiply that away — which is why the palette-derived tint this used to
      // compute was never passed to the sprite, and is gone.
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
        view.textLayer = createTextLayer(data);
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
        const textLayer = createTextLayer(data);
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

    // The bands were just placed at the un-panned centre. If the camera has
    // already drifted (a relayout or a theme swap mid-session), re-apply it —
    // otherwise the scenery snaps back to the start of the journey and only
    // catches up on the next verse.
    updateParallaxPositions();
  }

  // Re-position everything for the current puzzle on resize.
  function relayout() {
    wake();
    if (verse) {
      const savedPlaced = tiles.map((t) => ({ id: t.id, slot: t.placedSlotIndex }));
      // Rebuild with the same chain verses so a resize mid-passage doesn't
      // silently collapse a stage-5 chain back to a single verse.
      // Preserve the current puzzle stage so a resize or top-inset shift mid-puzzle
      // (e.g. prompt text line wrapping/unwrapping) never resets the stage.
      const currentStage = puzzle ? puzzle.layer : undefined;
      buildPuzzle(verse, currentChainVerses, 0, currentStage);
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

    // Only publish the puzzle hook once a puzzle actually exists. `relayout()`
    // also runs from the boot-time ResizeObserver, before `nextPuzzle()` has
    // built anything; publishing an empty hook there made the e2e readiness
    // probe (`typeof __lampGamePuzzle === 'function'`) succeed against a
    // half-booted game, so the tests raced the engine and asserted against the
    // "Lighting the lamps…" loading screen.
    if (puzzle) (window as any).__lampGamePuzzle = () => puzzle;
    (window as any).__lampGameCameraScrollX = cameraScrollX;
    (window as any).__lampGameFluencyRing = fluencyRingSprite;
    (window as any).__lampGameParticles = particleSprites;
    (window as any).__lampGameLighthouses = lighthouseSprites;

    // Read-only geometry, for the layout e2e spec: it asserts that the measured
    // DOM overlay really does sit above the verse band, and that the surface is
    // rendering at the device's own pixel ratio. Nothing today asserts the
    // *vertical* position of the verse, which is the defect this change fixes.
    const [cssW, cssH] = canvasSize();
    const l = getResponsiveMetrics(cssW, cssH);
    (window as any).__lampGameLayout = {
      surfaceScale: surfaceScale(),
      topInset,
      chromeBottom: l.chromeBottom,
      headerY: l.headerY,
      hudY: l.hudY,
      hudFont: l.hudFont,
      hudTextTop: l.hudTextTop,
      hudTextBottom: l.hudTextBottom,
      slotAreaTop: l.slotAreaTop,
      /** The first row of the verse's answer slots. */
      verseTop: l.slotAreaTop,
      pathY: l.pathY,
      canvasCss: { W: cssW, H: cssH },
      bands: {
        sky: 0,
        far: l.pathY + SCENERY_BANDS.far.top,
        mid: l.pathY + SCENERY_BANDS.mid.top,
        near: l.pathY + SCENERY_BANDS.near.top,
        bottom: l.pathY + SCENERY_BANDS.near.bottom,
      },
    };

    // Read-only render-loop state, for the idling e2e spec. `rendering` is the
    // engine's own loop, which is what costs the battery; `looping` is ours.
    // Sampled rather than evented on purpose — a test polls it after a period of
    // no interaction, which is exactly the condition being asserted.
    (window as any).__lampGameRendering = () => ({
      rendering: engineRunning,
      looping: loopRunning,
      hidden,
      reducedMotion: opts.reducedMotion,
      ambientSprites: ambientSpriteCount(),
      particles: particleSprites.length,
      /** ms since the last wake — how long the scene has been still. */
      quietMs: performance.now() - lastActivityAt,
    });
  }

  /**
   * Report the current level/XP/combo to the host, which renders them as DOM text.
   *
   * This used to rebuild a canvas text layer on every call — dispose the old
   * `DefaultTextData`, remove the layer, create both again — which is a fair
   * amount of work to re-draw a string that only changes on a level-up or a
   * resolved lamp. The host holds it in React state instead.
   */
  function publishStats() {
    opts.callbacks.onStatsChange?.({
      level: gameState.level,
      xp: gameState.xp,
      combo,
    });
  }

  function updateParallaxPositions() {
    if (disposed) return;
    const [W, H] = canvasSize();
    const { pathY } = getResponsiveMetrics(W, H);

    // The sky never pans: it is the far distance, and it covers the canvas.
    // Only the three bands move, each by its own factor.
    if (farSprite) {
      updateSprite2D(farSprite, {
        positionPx: [W / 2 - cameraScrollX * SCENERY_BANDS.far.parallax, pathY + (SCENERY_BANDS.far.top + SCENERY_BANDS.far.bottom) / 2],
      });
    }
    if (midSprite) {
      updateSprite2D(midSprite, {
        positionPx: [W / 2 - cameraScrollX * SCENERY_BANDS.mid.parallax, (pathY + SCENERY_BANDS.mid.top + H) / 2],
      });
    }
    if (nearSprite) {
      updateSprite2D(nearSprite, {
        positionPx: [W / 2 - cameraScrollX * SCENERY_BANDS.near.parallax, pathY + (SCENERY_BANDS.near.top + SCENERY_BANDS.near.bottom) / 2],
      });
    }

    // The lighthouses and everything attached to them (halo, beacon beam,
    // fluency ring, flame, shadow, pool, reflection) are NOT scrolled. They are
    // the session's progress board: all 12 stay on screen and light up
    // left-to-right, and each lamp's decorations are laid out at its own tower
    // position by `buildPuzzle`. Moving only some of them here — the towers and
    // halos but not the flames, and by a step larger than their own spacing — is
    // what used to drag the row off the left edge and leave flames floating over
    // empty sky.
  }

  /**
   * Make sure a frame is produced for whatever just changed.
   *
   * Called from every visual mutation in this file — the four sprite/text
   * wrappers, `relayout`, `buildPuzzle`, the input handlers, the resize observer —
   * so that stopping the engine is invisible: whatever the loop decided when it
   * last went quiet, the next thing that moves starts it again. Mutations made by
   * the loop itself are ignored, since they are precisely what the settle check
   * is measuring.
   */
  function wake() {
    if (disposed || inFrameLoop) return;
    lastActivityAt = performance.now();
    if (hidden) return; // no frames to produce; `visibilitychange` wakes it
    startEngineIfNeeded();
    if (loopRunning) return;
    loopRunning = true;
    animFrameId = requestAnimationFrame(frameLoop);
  }

  /**
   * Start the engine's own loop if it is stopped. `startEngine` resolves after the
   * first frame, so the flag is raised *before* awaiting: a second `wake()` in the
   * same tick must not start a second loop.
   */
  function startEngineIfNeeded() {
    if (engineRunning || disposed) return;
    engineRunning = true;
    void startEngine(engine);
  }

  /** Stop both loops: ours, and the engine's per-frame render. */
  function stopRendering() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    loopRunning = false;
    if (!engineRunning) return;
    engineRunning = false;
    // `stopEngine` flushes the retired GPU resources (`engine.js:204`). That
    // flush also runs at the end of every rendered frame, but the frame after a
    // stop is the one that never comes — so a puzzle torn down just before the
    // scene settled would otherwise hold its retired atlas bindings until
    // something happened to move again.
    stopEngine(engine);
  }

  /** Ambient sprites that exist right now — flames, beams, reflections. */
  function ambientSpriteCount(): number {
    return lampFlameSprites.length + beaconBeamSprites.length + lampReflectSprites.length;
  }

  function frameLoop() {
    if (disposed) {
      loopRunning = false;
      return;
    }
    animFrameId = null;
    inFrameLoop = true;
    try {
      runFrame();
    } finally {
      inFrameLoop = false;
    }

    const now = performance.now();
    if (
      shouldKeepRendering({
        panning: Math.abs(targetCameraScrollX - cameraScrollX) > 0.5,
        particles: particleSprites.length,
        ambientSprites: ambientSpriteCount(),
        reducedMotion: opts.reducedMotion,
        lastActivityAt,
        now,
      })
    ) {
      animFrameId = requestAnimationFrame(frameLoop);
      return;
    }
    // Nothing is moving and nothing is going to move on its own: hand the GPU
    // back. The last presented frame stays on the canvas, so the scene the player
    // is looking at is unchanged — it is simply no longer being redrawn 60 times
    // a second.
    stopRendering();
  }

  /** One frame of everything the scene animates. */
  function runFrame() {
    // Smooth camera pan between verses (~0.5s transition)
    // Lerp factor 0.025 at 60fps gives ~120 frames = ~0.5s for most of the motion
    if (Math.abs(targetCameraScrollX - cameraScrollX) > 0.5) {
      cameraScrollX += (targetCameraScrollX - cameraScrollX) * 0.025;
      updateParallaxPositions();
      (window as any).__lampGameCameraScrollX = cameraScrollX;
      (window as any).__lampGameLighthouses = lighthouseSprites;
    }

    const now = performance.now();
    // The real frame delta, clamped so a backgrounded tab (or a long GC pause)
    // cannot fling the particles off the screen on the frame it returns. It
    // replaces the hardcoded 16 ms, which was only ever a 60 fps assumption.
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameAt) / 1000));
    lastFrameAt = now;

    // Update particle positions and lifetimes. These run on every frame, at the
    // real cadence: a celebration burst is the one animation whose speed the
    // player is actually watching.
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

    // The ambient pulse — flame flicker, beam sweep, reflections — runs at its
    // own slower cadence. It is a slow effect (the flame's period is ~1.25 s), so
    // updating it 30 times a second instead of 60 is invisible, and it is the
    // work the loop would otherwise do for the entire time a verse is on screen.
    const ambient = ambientSpriteCount() > 0 && !opts.reducedMotion;
    if (ambient && now - lastAmbientAt >= AMBIENT_INTERVAL_MS) {
      lastAmbientAt = now;
      animateAmbient(now / 1000);
    }
  }

  /** The ambient pulse: flame flicker, beam sweep, reflections breathing. */
  function animateAmbient(t: number) {
    // Animate lighthouse flames (flickering)
    for (let i = 0; i < lampFlameSprites.length; i++) {
      const flame = lampFlameSprites[i];
      const flicker = 0.8 + 0.2 * Math.sin(t * 8 + i);
      const sway = 0.5 * Math.cos(t * 6 + i * 0.5);
      updateSprite2D(flame.sprite, {
        positionPx: [flame.baseX + sway, flame.baseY],
        color: [1, 0.85 + 0.15 * flicker, 0.3, 0.9],
        sizePx: [flame.baseSize * (0.95 + 0.1 * flicker), flame.baseSize * (0.95 + 0.1 * flicker)],
      });
    }

    // Animate beacon beams (slow sweeping rotation about the lantern)
    for (const beam of beaconBeamSprites) {
      const sweep =
        beam.restSweep + Math.sin(t * 0.5 + beam.phase) * (beam.isCurrent ? 0.22 : 0.12);
      const alphaPulse = 0.7 + 0.3 * Math.sin(t * 2 + beam.phase);
      const baseColor = beam.isCurrent ? [1, 0.95, 0.5, 0.9] : [1, 0.85, 0.3, 0.6];
      updateSprite2D(beam.sprite, {
        positionPx: [
          beam.apexX + Math.sin(sweep) * (beam.h / 2),
          beam.apexY - Math.cos(sweep) * (beam.h / 2),
        ],
        rotation: -sweep,
        color: [baseColor[0], baseColor[1], baseColor[2], baseColor[3] * alphaPulse],
      });
    }

    // The reflections on the water breathe, out of phase with each other, so the
    // waterline glow shimmers instead of sitting there as twelve static stripes.
    for (const refl of lampReflectSprites) {
      const pulse = 0.8 + 0.2 * Math.sin(t * 1.3 + refl.phase);
      updateSprite2D(refl.sprite, {
        color: [1, 1, 1, 0.24 * 0.85 * pulse],
      });
    }
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
    // Touch is the strongest signal of "the scene should be moving": it restarts
    // the ambient pulse as well as producing frames, so a tap on a still scene
    // brings the flames back rather than leaving them frozen under a drag.
    wake();
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
    wake();
    const [x, y] = pointerPos(e);
    setTilePos(dragging, x - dragOffX, y - dragOffY);
  }
  function onPointerUp(e: PointerEvent) {
    wake();
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
      // Create particle burst at the active lighthouse position. The lamp row is
      // anchored to the canvas (never parallax-scrolled) and capped at 12 lamps,
      // so this must use the same capped index and layout as `buildPuzzle` — a
      // larger queue length would put the burst off the end of the row.
      const [W, H] = canvasSize();
      const { isMobile, margin, pathY } = getResponsiveMetrics(W, H);
      const lampCount = Math.min(12, queue.length);
      const activeIndex = Math.max(0, Math.min(queueIndex - 1, lampCount - 1));
      if (lampCount > 0) {
        const lampStep = (W - 4 * margin) / Math.max(1, lampCount - 1);
        const lx = 2 * margin + activeIndex * lampStep;
        // The same geometry `buildPuzzle` lays the row out with, so the burst
        // lands in the lantern the player just lit. The current lamp is the one
        // being resolved, so its tower is drawn at the tall `current` height.
        const towerH = isMobile ? TOWER_H.mobile : TOWER_H.desktop;
        const lanternCenterY =
          pathY + TOWER_FOOT_BELOW_PATH - TOWER_LANTERN_ABOVE_FOOT * towerH.current;
        createParticleBurst(lx, lanternCenterY, 16 + combo * 2);
      }
      gameState.xp += earnedXp;
      gameState.level = levelForXp(gameState.xp);
      gameState.comboBest = Math.max(gameState.comboBest, combo);
      saveGameState(gameState);
      publishStats(); // the host re-renders the level/XP line
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

    feedbackLayer = createTextLayer(feedbackData);
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
          if (stageOverride === 0) {
            stageOverride = 1;
          }
          const boot = progressFor(verse.reference);
          if (boot && boot.customClozeLevel === 0) {
            boot.customClozeLevel = 1;
          }
          buildPuzzle(verse, null, 1, 1);
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
    // Woken up front rather than at each mutation below: the two terminal branches
    // ("No verses available", "Journey Complete!") build only text layers, and this
    // is the frame that has to show them after a stopped loop.
    wake();
    if (queue.length === 0) {
      // Nothing to practice — show a static message.
      teardownPuzzle();
      const [W] = canvasSize();
      headerData = createDefaultTextData(font, HEADER_FONT, 'No verses available', textColor(SCENERY_TEXT_COLORS.text), { align: 'center' });
      headerLayer = createTextLayer(headerData, (W - headerData.width) / 2, HEADER_Y);
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
      // The count comes from the queue rather than a hardcoded 12: a swap that
      // finds no verse the player hasn't seen moves an upcoming verse into the
      // current slot and shortens the queue (see `moveQueueSlot`), so a session
      // can legitimately finish a lamp early.
      const lampWord = queue.length === 1 ? 'Lamp' : 'Lamps';
      headerData = createDefaultTextData(font, HEADER_FONT, `Journey Complete! All ${queue.length} ${lampWord} Lit!`, textColor(SCENERY_TEXT_COLORS.accent), { align: 'center' });
      headerLayer = createTextLayer(headerData, (W - headerData.width) / 2, HEADER_Y);
      addTextRendererLayer(textRenderer, headerLayer);

      promptData = createDefaultTextData(font, PROMPT_FONT, 'Tap Play Again for a new journey, or Exit', textColor(SCENERY_TEXT_COLORS.text), { align: 'center' });
      promptLayer = createTextLayer(promptData, (W - promptData.width) / 2, HEADER_Y + 44);
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

    // Task C-4: Parallax camera scroll offset tracking verse progression.
    // The pan is the whole session's travel (PARALLAX_PAN_*) scaled by how far
    // along the journey the current lamp is — a gentle drift of the landscape
    // rather than a per-verse jump that walks the world off the screen.
    const [W, H] = canvasSize();
    const { isMobile } = getResponsiveMetrics(W, H);
    const lampCount = Math.min(12, queue.length);
    const activeIndex = Math.max(0, Math.min(queueIndex - 1, lampCount - 1));
    const pan = isMobile ? PARALLAX_PAN_MOBILE : PARALLAX_PAN_DESKTOP;
    // `reducedMotion` is the host's `prefers-reduced-motion` (see
    // PracticeModeGameIdeas.md, "Reduced motion": disable parallax). Hold the
    // camera at the start of the journey so the landscape never drifts.
    targetCameraScrollX = opts.reducedMotion
      ? 0
      : lampCount > 1 ? (activeIndex / (lampCount - 1)) * pan : 0;

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
    // A resize while the loop is stopped still has to be drawn: `resizeEngine`
    // reconfigures the swapchain, and the canvas owes the player a frame at its
    // new size. The engine's own loop does this per frame, so it needs doing for
    // it here when that loop is not running.
    wake();
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
  engineRunning = true;
  loopRunning = true;
  animFrameId = requestAnimationFrame(frameLoop);
  nextPuzzle();

  // A backgrounded tab gets no frames from `requestAnimationFrame` at all, so the
  // loop is not merely wasteful there — it is stopped and restarted by the
  // browser, which is what makes the `dt` clamp in `runFrame` necessary. Stop
  // explicitly instead: on return, the scene resumes where it was, and the ambient
  // pulse restarts because coming back to the tab is activity.
  const onVisibilityChange = () => {
    hidden = document.visibilityState === 'hidden';
    if (hidden) {
      stopRendering();
      return;
    }
    wake();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // =========================================================================
  // Public handle.
  // =========================================================================
  function setTheme(next: GameTheme) {
    theme = next;
    palette = paletteFor(theme);
    // Rebuild the current puzzle so every sprite/text adopts the new palette.
    // Preserve the current puzzle stage so a theme toggle doesn't reset it.
    const current = verse;
    const currentStage = puzzle ? puzzle.layer : undefined;
    if (current) buildPuzzle(current, currentChainVerses, 0, currentStage);
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

  function setTopInset(px: number) {
    // Ignore sub-2px churn. A ResizeObserver fires on fractional layout shifts
    // (a scrollbar appearing, a font settling) and each accepted change rebuilds
    // the whole puzzle — an animation the player would see as a flicker.
    if (Math.abs(px - topInset) < 2) return;
    topInset = px;
    // A pure re-layout, not a rebuild: `relayout()` re-places the existing verse
    // and restores any tiles already in slots, so the player's progress through
    // the puzzle survives the chrome band changing height mid-verse.
    relayout();
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
   * the journey. The replacement takes the skipped verse's slot in place, so the
   * queue keeps its length and the session stays winnable; the skipped verse is
   * dropped from this game entirely (see `sessionSkippedRefs`) and recorded in
   * the deferred set so it isn't immediately re-chosen next session either.
   * Triggered by the circular right-arrow button and by a right-to-left swipe on
   * empty canvas.
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
    const skippedRefs = new Set<string>();
    for (let i = start; i < queueIndex; i++) {
      const qv = queue[i];
      if (qv) skippedRefs.add(qv.reference);
    }

    // Pick a replacement the player has not been shown yet.
    //
    // A session is 12 lamps showing 12 DISTINCT verses — a verse the player has
    // already met must never come back as one of them. That rules out the two
    // obvious sources: a verse already lit this session, and a verse that is
    // merely QUEUED for a later lamp (swapping a copy of one of those into the
    // current slot is what used to make already-solved verses reappear later in
    // the game). So the replacement comes from the host pool's unused verses —
    // verses outside the queue entirely. A deferred verse ("not now") is
    // avoided when anything else is left, but is still better than a repeat.
    const inQueue = new Set(queue.map((v) => v.reference));
    const deferredSet = new Set(gameState.deferredRefs ?? []);
    const isUnused = (v: KJVVerse) =>
      !skippedRefs.has(v.reference) &&
      !sessionLitRefs.has(v.reference) &&
      !sessionSkippedRefs.has(v.reference) &&
      !inQueue.has(v.reference);
    let candidates = opts.pool.filter((v) => isUnused(v) && !deferredSet.has(v.reference));
    if (candidates.length === 0) candidates = opts.pool.filter(isUnused);

    // The skipped verse is dropped from the queue (not re-appended, which would
    // both resurrect it later this game and make the final lamp unreachable) and
    // recorded so it can't be re-picked as a replacement or re-presented.
    let swapped: { queue: KJVVerse[]; skipped: string[] };
    let replacement: KJVVerse;
    if (candidates.length > 0) {
      // The replacement takes the current lamp's slot IN PLACE, so the queue
      // length — and therefore the "queueIndex >= queue.length" win condition —
      // is preserved no matter how many times the player skips.
      replacement = candidates[Math.floor(Math.random() * candidates.length)];
      swapped = replaceQueueSlot(queue, start, currentChainLen, replacement);
    } else {
      // The pool has nothing left that the player hasn't already been shown, so
      // MOVE an upcoming verse into this slot instead of repeating one. The
      // queue loses the slot it vacated (the session ends one lamp early), which
      // the win condition already handles.
      const usable = (v: KJVVerse) =>
        !skippedRefs.has(v.reference) &&
        !sessionLitRefs.has(v.reference) &&
        !sessionSkippedRefs.has(v.reference);
      const upcoming = queue.slice(queueIndex).filter(usable);
      if (upcoming.length === 0) return; // nothing to swap to — stay put
      replacement = upcoming[Math.floor(Math.random() * upcoming.length)];
      swapped = moveQueueSlot(queue, start, currentChainLen, replacement);
    }
    queue = swapped.queue;
    for (const ref of swapped.skipped) {
      sessionSkippedRefs.add(ref);
      deferRef(ref);
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
    loopRunning = false;
    document.removeEventListener('visibilitychange', onVisibilityChange);
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

  // Read-only debug handles for the session's verse queue and the current
  // puzzle's geometry. They let e2e tests assert on the *session* (which 12
  // verses were queued, in what order, with what duplicates) and drive a real
  // pointer tap at a tile's on-screen position, rather than only inspecting the
  // puzzle the engine happens to be showing.
  (window as any).__lampGameQueue = () => queue.map((v) => v.reference);
  (window as any).__lampGameQueueIndex = () => queueIndex;
  (window as any).__lampGameTiles = () =>
    tiles.map((t) => ({
      id: t.id,
      word: t.word,
      display: t.display,
      homeX: t.homeX,
      homeY: t.homeY,
      w: t.w,
      h: t.h,
      placedSlotIndex: t.placedSlotIndex,
    }));
  (window as any).__lampGameSlots = () =>
    slots.map((s) => ({
      index: s.index,
      word: s.word,
      preFilled: s.preFilled,
      x: s.x,
      y: s.y,
      w: s.w,
      h: s.h,
    }));

  return { dispose, setTheme, setStage, setTopInset, skipLamp, swapVerse: swapCurrentVerse, getPuzzle: () => puzzle };
}
