# Implementation Handoff — "Lamp of the Path" Game Mode (TDD)

> **Purpose:** A self-contained, agent-runnable implementation plan for building
> the new practice game described in `PracticeModeGameIdeas.md`, using
> test-driven development. A group of agents can pick up tasks from this doc and
> build them in parallel with minimal coordination, because the interfaces are
> fixed up front and the testable logic is isolated from the untestable
> render layer.
>
> **Status:** Planning artifact for review. No code has been written.
> **Design spec:** `PracticeModeGameIdeas.md` (read it first — this doc assumes
> it).

---

## 0. How to use this handoff (for the building agents)

### Workflow rules
- **TDD, strictly.** For every logic task: write the failing test first
  (`bun run test:run` shows red), implement until green, then refactor. Do not
  write implementation for a pure-logic module before its test exists.
- **Run the tests constantly.** `bun run test:run` (unit, Vitest + jsdom).
  `bun run e2e` (Playwright, auto-builds + serves `./dist`) for integration.
  Never leave the suite red.
- **Do not break existing tests.** The repo has ~25 unit-test files and 6 e2e
  specs. Your change is not done until `bun run test:run` AND `bun run build`
  both pass clean. Run both before declaring a task complete.
- **Git discipline (from the user's global rules):** YOU DO NOT COMMIT, PUSH,
  MERGE, REBASE, OR BRANCH. Leave all changes uncommitted in the working tree
  for the user to review and commit. You may run read-only git commands
  (`status`, `diff`, `log`). Stage nothing.
- **Match the codebase.** TypeScript with `strict: false` (don't *rely* on that
  — write clean typed code anyway). Tests import `{ describe, it, expect }`
  from `'vitest'` explicitly even though `globals: true` is on — follow that
  convention. Use the existing glassmorphism/Tailwind classes for any React
  UI; do not introduce a new styling system.
- **One task per agent at a time.** Claim a task by its ID; when green, mark it
  done and pick the next unblocked one. Tasks declare `depends-on` and
  `parallel-with` so you know what's safe to run concurrently.

### The single most important architectural rule
> **Put ALL game logic in pure TypeScript modules under `src/game/`. The Babylon
> engine and the React host component must contain NO testable logic — they
> only wire pure modules to input/render/storage.**

Reason: Babylon/WebGL cannot run in jsdom, so the engine cannot be unit-tested.
By isolating logic into pure functions, every behavior is TDD-covered by fast
Vitest tests; the engine is covered by Playwright e2e against a real Chromium
that *does* have WebGL. This split is what makes parallel agent work safe.

---

## 1. Architectural decisions (locked)

| Decision | Choice | Rationale (see ideas doc §11) |
|---|---|---|
| Engine | **Babylon.js (tree-shaken 2D "Lite" build)**, imported as a JS module | Pure-TS, integrates into Vite/React, native `localStorage` access, small 2D bundle, crisp text. Godot rejected for v1 (heavy HTML5 export, iframe bridge, text/IME issues). |
| Dimension | **2D (parallax 2.5D)** | Text legibility, mobile load, accessibility. 3D deferred to an optional later variant. |
| Loading | **Code-split + `React.lazy`** the game bundle | Keeps the rest of the site's first load untouched. |
| Integration model | **A new practice mode**, surfaced as an 8th card in the mode selector that navigates to a **full-page route** `/practice/game` (not rendered inside the `max-w-3xl` Practice container). | Full-page canvas vs. the narrow practice column. |
| Progress | **Unified.** The game calls the *existing* `src/hooks.ts` mutations — no parallel progress store. A verse mastered anywhere is lit in the game. | Hard requirement (ideas doc §13). |
| New storage | One optional cosmetic key `kjv-game-state` only. All mastery/schedule data reuses existing keys. | Privacy/no-backend promise preserved. |
| Session `mode` bucket | Add a new `'game'` value to the session `mode` union (currently `'recall'|'multiple-choice'|'reference'|'fill-blank'`) for honest Statistics. | Cleaner than overloading `'fill-blank'`. |

---

## 2. Module map (what to create)

All new code lives under `src/game/` (pure logic) plus `src/components/Game.tsx`
(React host) and small edits to existing files (integration).

```
src/game/
├── types.ts          # Shared types (TilePuzzle, SlotSpec, GameState, …)
├── scaffold.ts       # Build a tile puzzle for a verse at a given mastery layer
├── scoring.ts        # Score a placed puzzle, XP, combo, performance rating
├── selection.ts      # "Next lamp" queue: due-first, least-practiced ordering
├── regions.ts        # Mastery-gated region unlocks + "Build a Road" branches
├── voice.ts          # Fuzzy match a speech transcript to a verse
├── state.ts          # kjv-game-state load/save/defaults
├── engine/
│   ├── LampGame.ts    # Babylon scene: path, lamps, tiles, input (thin shell)
│   └── theme.ts       # Light/dark palette sync (reads kjv-theme)
└── index.ts          # Public re-exports the host component uses

src/components/
└── Game.tsx          # React host: full-viewport <canvas>, lazy-loads engine,
                      #   wires hooks, theme sync, exit button, reduced-motion

# Edits to existing files (integration — Stream B):
src/App.tsx                      # add route /practice/game
src/components/Practice.tsx      # add 'lamp-path' to PracticeMode + MODE_INFO + card
src/components/Achievements.tsx  # add game achievement types + progress
src/utils/settingsTransfer.ts    # add 'kjv-game-state' to ALL_KJV_STORAGE_KEYS
src/storage.ts                   # (optional) GAME_STATE key + accessors, or keep in game/state.ts
package.json                    # add @babylonjs/core dependency
```

---

## 3. Integration contract (exact things to call / edit)

These are the real signatures from the current codebase. Code against these
verbatim so the game plugs in cleanly.

### Hooks to call (`src/hooks.ts`) — DO NOT reimplement
```ts
// Per-verse progress: increments timesRecited, updates streak/accuracy/status.
// status becomes 'mastered' when streak>=5 && accuracy>=90.
const { mutate: doUpdateProgress } = useUpdateProgressMutation();
await doUpdateProgress({ reference: string, correct: boolean, accuracy: number });

// Spaced-repetition schedule: sets nextReview interval from streak/accuracy.
const { mutate: doUpsertReviewSchedule } = useUpsertReviewScheduleMutation();
await doUpsertReviewSchedule({ reference, correct, streak, accuracy });

// One session record per play.
const { mutate: doCreateSession } = useCreateSessionMutation();
await doCreateSession({ versesPracticed: string[], mode: 'game', score: number, totalQuestions: number });

// Award a badge (idempotent-ish: pushes a new entry each call — check earned set first).
const { mutate: doAwardAchievement } = useAwardAchievementMutation();
await doAwardAchievement({ type: string, verseCount?: number, book?: any });

// Daily goal.
const { mutate: doUpdateDailyGoal } = useUpdateDailyGoalMutation();
await doUpdateDailyGoal({ completedVerses: number });

// Reads (return [data, loading, error]):
const [progress]    = useMyProgress();     // any[] of { verse:{reference}, status, timesRecited, streak, accuracy, customClozeLevel }
const [dueReviews]  = useDueReviews();     // any[] of { verse:{reference}, dueDate, interval, ... }
const [bookmarks]   = useMyBookmarks();    // any[] of { reference, ... }
```
`useMutation` returns `{ mutate, data, loading, error }`; `mutate(args)` returns a Promise.

### Pure helpers to reuse (`src/utils/practiceHelpers.ts`) — DO NOT duplicate
```ts
buildWordBank(text, _seed?)            // Fisher–Yates shuffled word tokens
checkWordBankAnswer(selectedTokens, targetText)  // boolean, normalised compare
toFirstLetters(text)                  // "F G s l t w"
getVanishingClozeLevel(timesRecited)  // 0|1|2|3|4
getVanishingClozeMask(text, level)    // boolean[] (which words blanked)
firstLetterOf(word)                   // first alpha letter
diffWords(userText, targetText)       // DiffToken[] (LCS alignment)
diffScore(diff)                       // { correct, total }
```
Note: `normalizeText` and `scoreRecall` are **local to `Practice.tsx` and not exported**. If you need them, add them to `practiceHelpers.ts` (exported) with tests — see task **I-1**.

### Spaced repetition (`src/utils/spacedRepetition.ts`)
```ts
calculateNextReview(schedule, performance)  // SM-2 (currently unused by the live hook — the game MAY wire it in)
extractKeywords(text, maxCount?)            // for non-curated verses
assessDifficulty(text)                      // 'easy'|'medium'|'hard'
```

### Verse data
```ts
// src/data/kjv-verses.ts
interface KJVVerse { reference: string; book: string; chapter: number; verse: number;
  text: string; keywords: string[]; difficulty: 'easy'|'medium'|'hard'; theme: string; }
export const KJV_VERSES: KJVVerse[];   // 41 curated verses

// src/data/kjv-bible.ts  (lazy-loads public/kjv.txt)
export async function getKJVVerse(reference: string): Promise<KJVVerseEntry | null>;
// KJVVerseEntry = { verse, text, reference } — NOTE: no keywords/difficulty/theme;
// generate with extractKeywords + assessDifficulty when building a KJVVerse.
```

### Storage (`src/storage.ts`)
Keys: `kjv-memorize-progress`, `kjv-memorize-sessions`, `kjv-memorize-achievements`,
`kjv-memorize-bookmarks`, `kjv-memorize-daily-goal`, `kjv-memorize-review-schedule`.
Accessors: `getProgress/setProgress`, `getReviewSchedule/upsertReviewSchedule`,
`getDailyGoal/updateDailyGoal`, `getBookmarks`, etc. The custom event
`kjv-storage-change` (detail `{ key }`) is the same-tab refresh signal — listen
to it to live-update lamps when progress changes elsewhere.

### Settings transfer (`src/utils/settingsTransfer.ts`)
`ALL_KJV_STORAGE_KEYS` is a `const [...]` array — **add `'kjv-game-state'`** so the
game's cosmetic state travels in export/import. (`importSettings` currently only
merges bookmarks; the new key will export fine; import can store it raw — extend
carefully, with tests.)

### Achievements (`src/components/Achievements.tsx`)
`AchievementType` union (10 values) + `ACHIEVEMENT_INFO` record. `book-complete`
and `testament-complete` are **defined but never awarded** today — the game is
where they finally get awarded (ideas doc §14). Add new game-only types here too.

### Test setup
`vite.config.ts` inlines the Vitest config: `environment: 'jsdom'`, `globals: true`,
`setupFiles: ['./src/test-setup.ts']` (polyfills `localStorage`). Tests live next
to source as `*.test.ts` / `*.test.tsx`. E2E lives in `e2e/` and is excluded
from Vitest. `bun run build` = `tsc && vite build` (type-checks everything).

---

## 4. Fixed interfaces for parallel work

These signatures are the contract. Agents in Stream A implement to them; agents
in Stream C code the engine/host against them; agents in Stream B wire them in.
**Do not change a signature without updating every dependent task.**

### `src/game/types.ts`
```ts
export type ScaffoldLayer = 0 | 1 | 2 | 3 | 4 | 5;
// 0 Study · 1 Order (Word Bank) · 2 First-letter order · 3 Cloze tiles
// 4 First-letter cloze · 5 Free recall (type/speak)

export type LampState = 'unlit' | 'learning' | 'reviewing' | 'mastered' | 'due';

export interface SlotSpec { index: number; word: string; preFilled: boolean; }
export interface TileSpec { id: string; word: string; display: string; } // display = word or first letter
export interface TilePuzzle {
  layer: ScaffoldLayer;
  reference: string;
  slots: SlotSpec[];   // target order; preFilled slots are already shown
  bank: TileSpec[];     // tiles the player drags in (shuffled)
  /** For layer 5: the puzzle is "free recall" — bank is empty, host shows typing/voice. */
  freeRecall: boolean;
}

export interface ProgressEntry { verse: { reference: string }; status: string; timesRecited: number; streak: number; accuracy: number; customClozeLevel?: 0|1|2|3|4; }
export interface DueEntry { verse: { reference: string }; dueDate: string; interval: number; }

export interface GameState {
  xp: number;
  level: number;            // cosmetic level index
  comboBest: number;
  unlockedRegionIds: string[];
  builtRoads: string[][];   // arrays of reference strings (branch roads)
  settings: { sound: boolean; voice: boolean; motion: boolean };
}
```

### `src/game/scaffold.ts`
```ts
import type { KJVVerse } from '../data/kjv-verses';
import type { ScaffoldLayer, TilePuzzle, ProgressEntry } from './types';

/** Map a verse's mastery → game scaffold layer (0–5). Honors customClozeLevel override. */
export function getGameLayer(timesRecited: number, customLevel?: 0|1|2|3|4|null, status?: string): ScaffoldLayer;

/** Build the tile puzzle for a verse at a layer. Deterministic given a seed. */
export function buildTilePuzzle(verse: KJVVerse, layer: ScaffoldLayer, seed?: number): TilePuzzle;
```

### `src/game/scoring.ts`
```ts
import type { ScaffoldLayer } from './types';

export interface PuzzleScore { correct: boolean; accuracy: number; }
/** Score a placed tile order against the target verse (reuses checkWordBankAnswer + diffScore). */
export function scoreTilePuzzle(placed: string[], target: string): PuzzleScore;

export type PerformanceRating = 'excellent' | 'good' | 'poor';
export function performanceRating(correct: boolean, usedHint: boolean, fluent: boolean): PerformanceRating;

export function computeXp(layer: ScaffoldLayer, verseWordCount: number, fluent: boolean, combo: number): number;
export function applyCombo(combo: number, correct: boolean): number;
export function levelForXp(xp: number): number;   // cosmetic level threshold curve
```

### `src/game/selection.ts`
```ts
import type { KJVVerse } from '../data/kjv-verses';
import type { ProgressEntry, DueEntry } from './types';

export interface SelectionInput {
  pool: KJVVerse[];            // unlocked-region verses + built-road verses
  progress: ProgressEntry[];
  due: DueEntry[];
  dailyGoalCompleted: boolean;
  limit: number;
}
/** Order: due reviews first, then least-practiced (mirrors Practice.tsx sort). */
export function selectNextLamps(input: SelectionInput): KJVVerse[];
```

### `src/game/regions.ts`
```ts
import type { KJVVerse } from '../data/kjv-verses';
import type { ProgressEntry } from './types';

export interface Region {
  id: string;
  name: string;
  verses: KJVVerse[];
  /** Number of mastered lamps required in earlier regions before this unlocks. */
  unlockRequirement: { masteredInPriorRegions: number };
}
/** The starter road: curated verses grouped by difficulty into regions. */
export function starterRegions(): Region[];
/** Which regions are unlocked given total mastered count. */
export function unlockedRegions(regions: Region[], masteredCount: number): Region[];
/** Build a branch road from a list of references (bookmarks / a chapter range). */
export function buildRoad(name: string, refs: string[], verses: KJVVerse[]): Region;
/** Lit / total lamps in a region. */
export function masteryProgress(region: Region, progress: ProgressEntry[]): { lit: number; total: number };
```

### `src/game/voice.ts`
```ts
/** Fuzzy-match a speech transcript to a verse. Normalises like checkWordBankAnswer,
 *  then requires a word-overlap threshold (default 0.85). Tolerant of order. */
export function matchRecitation(transcript: string, target: string, threshold?: number): { match: boolean; overlap: number };
```

### `src/game/state.ts`
```ts
import type { GameState } from './types';
export const GAME_STATE_KEY = 'kjv-game-state';
export const DEFAULT_GAME_STATE: GameState;
export function loadGameState(): GameState;     // merges defaults for missing fields
export function saveGameState(state: GameState): void;
```

---

## 5. Task streams

Tasks are grouped into **streams**. Within a stream, tasks are ordered by
dependency. Across streams, work is parallelizable as noted. Each task lists:
**Files** · **Test file** · **Acceptance** (the failing test that defines done) ·
**Depends-on** · **Parallel-with**.

### Stream A — Pure game logic (fully parallel; the TDD core)

These six modules share only `types.ts`. Once `types.ts` exists (task A-0),
all of A-1..A-6 can be built **concurrently by up to 6 agents** in separate
files with zero merge conflict.

| ID | Title | Files | Test | Acceptance (red→green) | Depends | Parallel |
|----|-------|-------|------|------------------------|--------|----------|
| **A-0** | Shared types | `src/game/types.ts` | `src/game/types.test.ts` (compile/type-level smoke: construct a `TilePuzzle`, `GameState`) | Types compile; a sample object satisfies the shape. | — | — |
| **A-1** | Scaffold builder | `src/game/scaffold.ts` | `src/game/scaffold.test.ts` | `getGameLayer(0)` → 0; `getGameLayer(10)` → 4; mastered+custom overrides; `buildTilePuzzle` at L1 returns bank = shuffled words, slots preFilled=false; at L0 slots preFilled=true, bank empty; at L5 `freeRecall=true`, bank empty; L3/L4 blank selection matches `getVanishingClozeMask` counts; deterministic with seed. | A-0 | A-2..A-6 |
| **A-2** | Scoring/XP/combo | `src/game/scoring.ts` | `src/game/scoring.test.ts` | `scoreTilePuzzle` correct order → `correct:true, accuracy:100`; wrong order → false; `performanceRating` maps (correct,no-hint,fluent)→excellent, (correct,hint)→good, (wrong)→poor; `computeXp` rises with layer & fluency & combo; `applyCombo` +1 on correct, 0 on wrong; `levelForXp` monotonic. | A-0 | A-1,A-3..A-6 |
| **A-3** | Lamp selection queue | `src/game/selection.ts` | `src/game/selection.test.ts` | Given a pool with 2 due + 3 not-due, `selectNextLamps` returns due first; among not-due, lower `timesRecited` first; respects `limit`; `dailyGoalCompleted` truncates to 0 (or returns only due) per spec decision. | A-0 | A-1,A-2,A-4..A-6 |
| **A-4** | Regions & Build-a-Road | `src/game/regions.ts` | `src/game/regions.test.ts` | `starterRegions()` returns 3 regions (easy/medium/hard) with the curated verses partitioned; `unlockedRegions` returns region 1 always, region 2 only when prior mastered ≥ threshold, etc.; `buildRoad` constructs a region from refs; `masteryProgress` counts `status==='mastered'`. | A-0 | A-1..A-3,A-5,A-6 |
| **A-5** | Voice fuzzy match | `src/game/voice.ts` | `src/game/voice.test.ts` | Exact spoken verse → `match:true, overlap:1`; one missing word of a 10-word verse → still ≥0.85 → true; two missing → <0.85 → false (tune threshold with tests); punctuation/case-insensitive; order-insensitive. | A-0 | A-1..A-4,A-6 |
| **A-6** | Game state storage | `src/game/state.ts` | `src/game/state.test.ts` | `loadGameState()` on empty storage returns `DEFAULT_GAME_STATE` with all fields; `saveGameState` then `loadGameState` round-trips; partial/legacy JSON merges defaults for missing keys (e.g. `settings` absent → defaults). | A-0 | A-1..A-5 |

**Test pattern example** (set the style for all of Stream A — write this FIRST, watch it fail, then implement):
```ts
// src/game/scaffold.test.ts
import { describe, it, expect } from 'vitest';
import { getGameLayer, buildTilePuzzle } from './scaffold';
import { KJV_VERSES } from '../data/kjv-verses';

describe('getGameLayer', () => {
  it('returns 0 for a never-practiced verse', () => {
    expect(getGameLayer(0)).toBe(0);
  });
  it('returns 4 at 10+ recitations', () => {
    expect(getGameLayer(10)).toBe(4);
  });
  it('honors a custom override', () => {
    expect(getGameLayer(0, 3)).toBe(3);
  });
  it('promotes to free-recall (5) when mastered', () => {
    expect(getGameLayer(12, null, 'mastered')).toBe(5);
  });
});

describe('buildTilePuzzle', () => {
  const v = KJV_VERSES.find(x => x.reference === 'Psalm 23:1')!;
  it('layer 0 pre-fills all slots and empties the bank (study)', () => {
    const p = buildTilePuzzle(v, 0, 1);
    expect(p.bank).toEqual([]);
    expect(p.slots.every(s => s.preFilled)).toBe(true);
    expect(p.freeRecall).toBe(false);
  });
  it('layer 1 puts all words in the bank, none pre-filled', () => {
    const p = buildTilePuzzle(v, 1, 1);
    expect(p.slots.every(s => !s.preFilled)).toBe(true);
    expect(p.bank.length).toBe(v.text.split(' ').length);
  });
  it('is deterministic for a fixed seed', () => {
    expect(buildTilePuzzle(v, 1, 42)).toEqual(buildTilePuzzle(v, 1, 42));
  });
  it('layer 5 is free recall (empty bank)', () => {
    const p = buildTilePuzzle(v, 5, 1);
    expect(p.freeRecall).toBe(true);
    expect(p.bank).toEqual([]);
  });
});
```

> **Determinism note:** existing helpers use `Math.random()` (non-deterministic)
> and accept an unused `_seed`. For the game, add a **seedable** shuffle (e.g. a
> small mulberry32 PRNG) inside `scaffold.ts` so tests are stable and so a given
> verse always puzzles the same way within one session. Do NOT change the
> existing `practiceHelpers` signatures; add the seeded variant locally.

---

### Stream B — Integration into existing files (sequential / careful)

These tasks touch **shared files**, so they must be coordinated. Run them in
order, one agent at a time, re-running the full suite after each.

| ID | Title | Files | Test | Acceptance | Depends |
|----|-------|-------|------|------------|---------|
| **B-1** | Export shared normalise/score helpers | `src/utils/practiceHelpers.ts` (+ test additions to `practiceHelpers.test.ts`) | extend existing test file | `normalizeText` and `scoreRecall` (currently local to `Practice.tsx`) are exported from `practiceHelpers.ts` with unit tests; `Practice.tsx` updated to import them (no behavior change); all existing tests still pass. | A-* (can start once A-0 merged; pure refactor) |
| **B-2** | Add `'game'` session mode | `src/components/Practice.tsx` (handleComplete L1477), `src/hooks.ts` (type only, if needed) | `src/components/Practice.verse-count.test.ts` or new `session-mode.test.ts` | A session with `mode:'game'` is persisted and round-trips; the `handleComplete` collapse maps `'lamp-path'` → `'game'`. Existing mode mappings unchanged. | B-1 |
| **B-3** | Add `kjv-game-state` to settings transfer | `src/utils/settingsTransfer.ts` (+ `settingsTransfer.test.ts`) | extend existing test | `ALL_KJV_STORAGE_KEYS` includes `'kjv-game-state'`; `collectSettings()` includes it; `importSettings` stores it raw (non-destructive); export→import round-trip test passes. | A-6 (for the key name) |
| **B-4** | Game achievements | `src/components/Achievements.tsx` (+ `Achievements.test.tsx` if present, else covered by e2e) | e2e + unit | Add game-only types to `AchievementType` + `ACHIEVEMENT_INFO` (e.g. `pathfinder`, `lantern-race`, `city-on-a-hill`, `light-of-the-world`); **finally award `book-complete` and `testament-complete`** from the game's completion path; `getProgress` hints added. | B-2, A-4 |
| **B-5** | Add 8th mode card + route | `src/components/Practice.tsx` (PracticeMode union, MODE_INFO, RECOMMENDED_MODES, ModeSelector), `src/App.tsx` (route `/practice/game` → `<Game/>`) | e2e | `'lamp-path'` added to `PracticeMode`; `MODE_INFO['lamp-path']` has label "Lamp of the Path", a flame icon (`Flame` from lucide), badge "New", `highlight:true`; the card navigates to `/practice/game`; the 6-recommended-modes e2e test still passes (card is a 7th recommended OR behind "show all" — decide and update the e2e expectation consistently). | B-2 |

---

### Stream C — Engine + React host (depends on A interfaces + B-5 route)

Start C-1 as soon as `types.ts` + the Stream A signatures are merged (agents can
code against the fixed interfaces even before implementations land, using stub
returns). C-2 depends on C-1 + the real A modules.

| ID | Title | Files | Test | Acceptance | Depends |
|----|-------|-------|------|------------|---------|
| **C-1** | React host component | `src/components/Game.tsx` | `src/components/Game.test.tsx` (RTL, mocked engine) | Renders a full-viewport `<canvas>`; shows a loading state while the engine lazy-loads; shows an Exit button that navigates back to `/practice`; reads `kjv-theme` and passes theme to the engine; on unmount calls `engine.dispose()` (verify the mock was disposed); respects `prefers-reduced-motion` by passing a flag. Engine module is `React.lazy`-imported so it's not in the main bundle. | B-5, A-* (signatures) |
| **C-2** | Babylon engine shell | `src/game/engine/LampGame.ts`, `src/game/engine/theme.ts`, `src/game/index.ts` | e2e only (no jsdom unit test — by design) | `LampGame` boots into a canvas, renders the parallax path + lamps + tile tray, handles pointer/touch drag AND keyboard (arrow+Enter) tile placement, reads pure modules for puzzle/score, calls the hook callbacks supplied by `Game.tsx`, syncs light/dark from `kjv-theme` + `kjv-storage-change`, disposes cleanly. **No branching logic in this file** — every decision goes through a pure module. | C-1, all A, B-2 |

---

### Stream D — End-to-end tests (depends on B + C)

| ID | Title | Files | Acceptance | Depends |
|----|-------|-------|------------|---------|
| **D-1** | Game e2e: entry + a full lamp | `e2e/practice.spec.ts` (extend) or `e2e/game.spec.ts` (new) | From `/practice`, the "Lamp of the Path" card is visible and navigates to the full-page game; a lamp renders; completing a tile puzzle lights the lamp; exiting returns to Practice; progress is reflected in `kjv-memorize-progress` (assert via `page.evaluate(localStorage.getItem(...))`). | C-2, B-5 |
| **D-2** | Game e2e: due-review + daily goal | same | A verse pre-seeded as due (via `localStorage` injection in the test) appears as a dimming/flickering lamp first; completing it advances the daily goal. | D-1 |
| **D-3** | Mobile viewport e2e | same | Run a test with `projects` mobile viewport (Playwright iPhone preset) confirming drag-by-touch works and the HUD collapses to icons. | D-1 |

---

## 6. Suggested agent assignment (for a group of ~4–6 agents)

| Agent | First | Then |
|-------|-------|------|
| Agent 1 (logic) | A-0 → A-1 | A-2 |
| Agent 2 (logic) | wait A-0 → A-3 | A-5 |
| Agent 3 (logic) | wait A-0 → A-4 | A-6 |
| Agent 4 (integration) | B-1 (after A-0) | B-2 → B-3 → B-4 → B-5 (sequential) |
| Agent 5 (engine/UI) | C-1 (after B-5 + A signatures) | C-2 |
| Agent 6 (e2e) | D-1 (after C-2) | D-2 → D-3 |

**Merge order to avoid conflicts:** Stream A files are disjoint — merge freely.
Stream B touches shared files — merge one at a time, re-running the suite. Stream
C adds new files except `Game.tsx` (new) and the route edit in B-5. The only
hot spots shared by multiple agents are `Practice.tsx` (B-2, B-4, B-5 — keep
these with ONE agent, Agent 4) and `Achievements.tsx` (B-4 only). **Rule: only
Agent 4 edits `Practice.tsx` and `Achievements.tsx`.**

---

## 7. Definition of Done (per task)

A task is complete only when ALL of:
1. Its acceptance test(s) exist and pass (`bun run test:run`).
2. `bun run test:run` is green overall (no existing test broken).
3. `bun run build` succeeds (TypeScript compiles, Vite bundles).
4. For Stream C/D: the relevant `bun run e2e` spec passes.
5. No `console.log` / debug leftovers; code matches repo style.
6. Changes are left **uncommitted** for the user.

---

## 8. Phase mapping (to the ideas-doc roadmap)

This handoff delivers **Phase 0 (spike) + Phase 1 (the path) + the integration
core of Phase 2/3**. Specifically:
- Phase 0 (a playable tile mode that unifies progress) = Stream A + B-1/B-2 + a
  minimal C-1/C-2 with a plain canvas (no scenery yet). **Ship this first as a
  milestone** — it's already a useful 8th mode.
- Phase 1 (path, lamps, dimming, Journey mode) = full C-2 + D-1/D-2.
- Phase 2 (fluency timer, combo, XP, sound) = scoring.ts XP/combo (A-2) wired
  into the engine + a sound toggle in `GameState.settings`.
- Phase 3 (Build-a-Road, region unlocks, Lantern Race) = regions.ts (A-4) +
  B-4 achievements + a Race sub-mode in the engine.
- Phase 4 (voice) = voice.ts (A-5) + Web Speech glue in the engine.
- Phase 5 (3D optional variant) = out of scope for this handoff.

If the team wants a minimum-viable milestone, **stop after Phase 0** and let the
user play it before investing in the scenery.

---

## 9. Risks & gotchas (read before starting)

- **Babylon in jsdom is impossible** — that's why the engine has zero unit tests
  by design. Don't try to mock Babylon for logic tests; instead extract the
  logic to pure modules and test those. If you find yourself writing `if` logic
  inside `LampGame.ts`, stop and move it to a pure module with a test.
- **Bundle size.** `@babylonjs/core` is large; import only the 2D pieces you use
  (e.g. `Engine`, `Scene`, `Vector3`, GUI) and rely on Vite tree-shaking. Verify
  with `bun run build` output sizes; the game chunk must be code-split
  (`React.lazy`) so it never weighs on the initial load. Set a soft budget
  (e.g. game chunk < ~600 KB gzipped) and flag if exceeded.
- **`Math.random()` vs determinism.** Existing helpers are non-deterministic
  and tests assert "usually different." The game's `scaffold.ts` must be
  seedable for stable tests and same-session consistency. Use a local PRNG;
  don't alter existing helper signatures.
- **`useAwardAchievementMutation` is not idempotent** — it pushes a new entry
  every call. Before awarding, check the earned set (the Achievements page
  derives `earnedTypes` from the array). Mirror the existing `handleComplete`
  pattern (it calls award unconditionally, relying on the UI to dedupe — follow
  suit or improve with a guard, but keep behavior consistent).
- **`getKJVVerse` is async and lazy-loads a 4.2 MB file.** "Build a Road" over
  a large range will fetch; show a loading state. Curated verses (`KJV_VERSES`)
  are synchronous and should be the default pool.
- **Daily-goal math.** `handleComplete` adds this session's correct count to
  `getDailyGoal().completedVerses` (the day-scoped base). The game must do the
  same — not replace it — or the daily goal double-counts/resets. Copy that
  exact pattern.
- **Session `mode` collapse.** `handleComplete` maps modes to
  `'recall'|'multiple-choice'|'reference'|'fill-blank'`. Add `'game'` and ensure
  `Statistics.tsx` (which reads sessions) handles it gracefully — check that
  file when doing B-2.
- **TypeScript `strict: false`.** Don't lean on it; write as if strict were on.
  `bun run build` runs `tsc` — any type error fails the build.
- **Godot is out of scope for v1.** If an agent proposes switching to Godot,
  stop — that's a Phase 5 decision for the user, not an implementation choice
  here.
- **Don't touch the user's branches/commits.** Leave everything uncommitted.

---

## 10. Open decisions for the user (resolve before Stream C/D)

These don't block Stream A or B-1/B-2/B-3 (pure logic + plumbing), but the
engine team needs them:

1. **Lantern Race & Build-a-Road in v1, or Phase-0-only first?** Recommend:
   ship Phase 0 (tile mode + path + Journey) as a milestone, then decide.
2. **`'lamp-path'` as a 7th recommended card, or behind "Show all modes"?**
   Recommend: 7th recommended (it's the headline feature), and update the e2e
   "shows 6 recommended modes" expectation to 7.
3. **Voice in v1?** Recommend: build `voice.ts` (A-5, cheap, pure) but defer the
   Web Speech engine glue to Phase 4.
4. **Sound default.** Recommend: off by default (`settings.sound = false`),
   toggle in HUD.
5. **Award `book-complete` / `testament-complete` by "all featured verses of a
   book/testament practiced" (existing definition) or by "all lamps in a
   built road of that book lit"?** Recommend the latter (matches the game's
   spatial model) — confirm with user since it changes achievement semantics.

---

## 11. Quick-start command reference (for the agents)

```bash
bun install                  # one-time; adds @babylonjs/core if not present
bun run test:run             # unit tests (Vitest) — run after every change
bun run test                 # watch mode while developing a module
bun run build                # tsc + vite build — type-check + bundle (CI gate)
bun run e2e                  # Playwright (auto-builds + serves ./dist)
bun run dev                  # local dev server at http://localhost:3000
```

When unsure of a signature, read the source (`src/hooks.ts`, `src/storage.ts`,
`src/utils/practiceHelpers.ts`) — this doc's signatures are copied from there
but the source is authoritative.

---

### One-line summary for the agent fleet

> Build `src/game/{types,scaffold,scoring,selection,regions,voice,state}.ts`
> TDD-first (Vitest, fully parallel), wire them into the app via
> `src/components/Game.tsx` + a `/practice/game` route + an 8th mode card, keep
> ALL logic out of the Babylon engine shell, run `bun run test:run` + `bun run
> build` green at every step, and leave everything uncommitted for Glenn to
> review.