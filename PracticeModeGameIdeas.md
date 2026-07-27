# Practice Mode Game Ideas — A New Engine-Driven Mode for kjv-ref

> Status: **Design proposal for review** — no code has been written.
> Author: Claude (analysis + design), for Glenn to review.
> Scope: Analyze the 7 existing practice modes, then design a brand-new,
> engine-driven (Godot or "Babylon Lite") practice *game* that is fun on both
> touch and mouse, takes the full page, scales to the whole Bible based on
> mastery (not a fixed 40), and maximizes how many KJV verses a player
> memorizes.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Analysis of the existing 7 practice modes](#2-analysis-of-the-existing-7-practice-modes)
3. [Design goals & memory-science rationale](#3-design-goals--memory-science-rationale)
4. [The recommended game: "Lamp of the Path"](#4-the-recommended-game-lamp-of-the-path)
5. [Visual & world design (2D recommended)](#5-visual--world-design-2d-recommended)
6. [Moment-to-moment gameplay — the recall mechanic](#6-moment-to-moment-gameplay--the-recall-mechanic)
7. [Verse selection & mastery-gated expansion (not a fixed 40)](#7-verse-selection--mastery-gated-expansion-not-a-fixed-40)
8. [Integration with spaced repetition & due reviews](#8-integration-with-spaced-repetition--due-reviews)
9. [Scoring, XP, levels & progression](#9-scoring-xp-levels--progression)
10. [Game sub-modes](#10-game-sub-modes)
11. [Engine choice: Godot vs Babylon Lite](#11-engine-choice-godot-vs-babylon-lite)
12. [Technical integration into the React app](#12-technical-integration-into-the-react-app)
13. [Data model & localStorage integration](#13-data-model--localstorage-integration)
14. [Achievements integration](#14-achievements-integration)
15. [Accessibility, performance & offline](#15-accessibility-performance--offline)
16. [Sound & "juice"](#16-sound--juice)
17. [Privacy & monetization](#17-privacy--monetization)
18. [Phased build roadmap](#18-phased-build-roadmap)
19. [Alternative concepts considered](#19-alternative-concepts-considered)
20. [Risks & open questions](#20-risks--open-questions)

---

## 1. Executive summary

The existing app has **7 strong, text-based practice modes** (Word Bank, First
Letters, Simplified Vanishing Cloze, Vanishing Cloze, Multiple Choice, Reference
Match, Full Recall) backed by an SM-2-style spaced-repetition scheduler and a
`learning → reviewing → mastered` ladder. They are excellent at *deliberate
practice* but share three gaps a game can fill:

1. **No fluency/automaticity pressure** — there are no timers anywhere, so
   "knowing" a verse never has to become *fast, effortless recall*.
2. **No spatial accumulation** — verses are practiced in isolation; there is no
   felt sense of a *growing collection* you've built and want to protect.
3. **No scaffolded bridge from recognition → free recall that is also *fun on a
   phone*** — the typing modes (Vanishing Cloze, Full Recall) are the most
   beneficial for memory but the most painful on a touchscreen keyboard.

The recommended new mode is a **2D, full-page, Babylon Lite (Babylon.js)
game called "Lamp of the Path."** It reimagines the existing Vanishing-Cloze
mastery ladder as a **tactile, drag-the-tiles-into-order mechanic** that is
native to both touch and mouse, layers in a **fluency timer** for flow, and
places every verse you master as a **lit lamp along a walking path through a
scriptural landscape**. The path extends as you master verses — so the verse
pool **grows with mastery instead of being capped at the curated 41** — and can
scale all the way to the full 24,857-verse Bible via the existing bookmark +
full-Bible loader. It hooks into the *same* `localStorage` progress, sessions,
achievements, and spaced-repetition schedule as the other 7 modes, so it is a
*practice mode*, not a separate app.

**Why this is the most beneficial design for memorizing as many verses as
possible:** it combines the three highest-yield memory techniques — *active
retrieval*, *spaced repetition*, and *elaborative/spatial encoding* (a memory
palace) — in a single loop, adds the missing *fluency* dimension, and uses
mastery-gated expansion so the collection is always exactly as big as the
player can keep alive. The spatial map turns "I have learned N verses" from an
abstract number into a visible, defendable world the player is emotionally
invested in protecting — which is the single biggest driver of long-term
retention: coming back.

---

## 2. Analysis of the existing 7 practice modes

All seven modes live in `src/components/Practice.tsx`; helpers in
`src/utils/practiceHelpers.ts`; scoring/mastery in `src/hooks.ts` and
`src/utils/spacedRepetition.ts`. Source pool: 41 curated verses in
`src/data/kjv-verses.ts`, plus any bookmarked verse fetched from the full Bible
via `src/data/kjv-bible.ts`.

| Mode (id) | Input | What the player does | Strength | Gap a game can address |
|---|---|---|---|---|
| **Word Bank** (`word-bank`) | Tap chips | Assemble verse by tapping shuffled word chips in order | Tactile, ordering, low friction on mobile | No recall depth (full words visible = recognition, not recall); no time pressure; no accumulation |
| **First Letters** (`first-letters`) | Tap chips + self-rate | Each word shown as first letter; tap to reveal; self-grade | Lightweight scaffold | Self-rated (no objective scoring); no fluency |
| **Simplified Vanishing Cloze** (`simplified-vanishing-cloze`) | 1-char typing per blank | Type just the first letter of each blanked word | Great adaptive scaffold; auto-advances | Still typing (mobile on-screen keyboard); single-letter = weak retrieval |
| **Vanishing Cloze** (`vanishing-cloze`) | Free typing | Type the full verse into a textarea; ≥70% = correct | Closest to true free recall; adaptive blanking by `timesRecited` | Typing on mobile is painful; no timer; one verse at a time, isolated |
| **Multiple Choice** (`multiple-choice`) | Click / 1–4 | Pick correct verse *text* from 4 options | Fast, low friction | Pure recognition — weakest for memory |
| **Reference Match** (`reference`) | Click / 1–4 | Given text, pick correct *reference* from 4 | Tests the verse↔reference link | Recognition, not recall |
| **Full Recall** (`recall`) | Free typing | Type the whole verse from memory; ≥80% = correct | Strongest recall test | Hidden by default; hardest; painful on mobile |

### Mastery & scheduling (the parts a game must respect, not reinvent)

- **Mastery ladder** (`src/hooks.ts`, `useUpdateProgressMutation`):
  `learning` → `reviewing` → `mastered`, where `mastered` requires
  `streak >= 5 && accuracy >= 90`; a wrong answer resets to `learning`.
- **Auto Cloze level** from `timesRecited` (`getVanishingClozeLevel`):
  0→L0, 1–2→L1 (25%), 3–5→L2 (50%), 6–9→L3 (75%), 10+→L4 (full).
- **Spaced repetition**: `useUpsertReviewScheduleMutation` sets
  `interval = min(round(streak * accuracy / 50), 30)` days; due reviews surface
  at the top of the queue and as a nav badge (`useDueReviews`).
- **Sessions** persisted via `useCreateSessionMutation` with
  `{versesPracticed[], mode, score, totalQuestions}`; `mode` is collapsed to
  `'recall' | 'multiple-choice' | 'reference' | 'fill-blank'`.
- **Achievements** (`src/components/Achievements.tsx`): 10 badge types; awarded
  in `handleComplete` (L1508–1530). `book-complete` and `testament-complete`
  are defined in the UI but **not currently awarded** — a game that scales to
  the whole Bible is the natural place to finally award them.
- **Daily goal**: default 5 verses/day in `kjv-memorize-daily-goal`.

### What is *not* present (the design space a game can own)

- **No timers / no fluency pressure** anywhere in the practice flow.
- **No canvas, no WebGL, no physics, no sound** — only CSS animations
  (`animate-fade-in`, `animate-float`, `animate-pulse-glow`).
- **No XP / levels / points** — only per-session % and per-verse status.
- **No spatial / cumulative representation** of what you've learned.
- **No cumulative chaining** of verses within a session (each verse is
  standalone; no "recite the whole psalm" flow).
- **No leaderboards/social** (privacy-by-design, no backend — and the game
  must keep this promise).

**Conclusion:** the existing modes are the *deliberate-practice* half of the
memory equation. The new game should be the *fluency + accumulation + emotional
investment* half, while reusing the exact same mastery/scheduling/storage
plumbing so progress is unified.

---

## 3. Design goals & memory-science rationale

The goal is "help someone memorize **as many KJV verses as possible**, scalable
with mastery." The four evidence-based levers for long-term verse memorization,
and how the game pulls each:

| Memory technique | What it means | How "Lamp of the Path" uses it |
|---|---|---|
| **Active retrieval** | Recalling from memory (not re-reading) beats re-reading by ~2× | Core mechanic is *reconstruct the verse*; scaffolding fades with mastery so the player is always just past their comfort zone |
| **Spaced repetition** | Reviews at expanding intervals arrest forgetting | Reuses the existing SM-2/streak schedule; the path *visibly shows* which lamps are dimming and due for a re-light |
| **Elaborative / spatial encoding** (memory palace) | Binding facts to locations doubles recall capacity | Each verse is bound to a *place* on the path; the reference becomes a signpost at that place |
| **Fluency / automaticity** | Fast, effortless recall is the real goal | A gentle timer + combo system rewards speed without punishing thought |

Plus the engagement levers that make people *come back* (the meta-goal, since
retention collapses without return visits):

- **Visible accumulation** — a growing, lit landscape you built.
- **Loss aversion / stewardship** — mastered lamps slowly dim toward "due"; you
  return to keep them lit. This reframes spaced repetition as *defending your
  map* rather than doing homework.
- **Mastery-gated expansion** — new terrain (and new verses) unlock only as
  existing ones are mastered, so the pool is always exactly as big as the
  player can sustain (see §7).

---

## 4. The recommended game: "Lamp of the Path"

**Tagline:** *Light the path, one verse at a time — then keep it lit.*

**Concept.** You are a traveler walking a path through a scriptural landscape
(a stylized 2D side-scrolling world: hills, a river, olive trees, a city on a
hill in the far distance). Each KJV verse you learn is a **lamp** placed at a
point on the path. To *light* a lamp you recall the verse; to *keep* it lit you
re-recall it on its spaced-repetition schedule. As you master verses, the path
extends forward and new verses unlock — the world literally grows with your
memory. The far goal is a fully lit road from Genesis to Revelation, but you
only ever see as far as your mastery has earned.

**Core loop (30–60 seconds):**

1. **Approach** a lamp. Its signpost shows the reference (e.g. *John 3:16*).
   Lamps are a **per-session journey**: all start unlit and light as you play
   through the session's ~10–12 verses. Lifetime mastery and due state are
   tracked silently underneath (for region unlocks and scheduling) but are
   *not* painted on the path.
2. **Recall** the verse using the tap/drag tile mechanic (§6). The scaffold
   stage is auto-set by the verse's `timesRecited` / mastery; difficulty scales
   by decoy count, never by typing or hiding words.
3. **Resolve** — correct: the lamp flares to full light, the path brightens, a
   chime plays, XP/combo accrues. Wrong: the lamp dims, the correct verse is
   shown for study, no penalty beyond lost combo.
4. **Advance** — the next lamp (next due/new verse) slides into view. Starting
   a new session lights a fresh set of lamps to aim for.

**Why a path of lamps?** It gives each session a tangible goal — light 10–12
lamps — and maps the existing per-verse mastery states onto something visible
and emotional. It also scales infinitely — the path never runs out of room.

---

## 5. Visual & world design (2D recommended)

**Recommendation: 2D, not 3D.** Reasons:

- **Text legibility is paramount** — this is a scripture app; 3D perspective
  warps and shrinks text. 2D keeps verse tiles and references crisp.
- **Bundle size & mobile load** — a 2D Babylon.js scene is a small JS payload;
  Godot 4's HTML5 export is multi-MB and slow to boot on mobile, which fights
  the app's "instant static page" ethos.
- **Accessibility** — 2D is easier to keep screen-reader/keyboard friendly and
  to render at any DPR without asset pipelines.
- **The metaphor doesn't need 3D** — a parallax 2.5D path with layered scenery
  reads as richly as 3D for this content, at a fraction of the cost.

A 3D version is viable (see §19) and could be a future "premium" toggle, but
v1 should be 2D.

**Art direction.** Reuse the app's existing glassmorphism + dark-mode palette
(`src/index.css`) so the game feels native, not bolted on:

- **Light mode:** dawn-lit hills, warm amber lamps, parchment verse tiles.
- **Dark mode:** twilight hills, glowing lamps as the primary light source,
  deep-blue sky with parallax stars — the lamps genuinely *illuminate* the
  scene (a point-light glow behind each tile). This makes dark mode the
  *prettier* mode for the game, a nice inversion.
- **Parallax layers** (3–4): far sky/mountains, mid hills, near path, foreground
  flora. Scroll gently as you advance, giving a sense of journey.

**Layout (full-page).** The game canvas takes the full viewport. A slim
overlay HUD (top): reference signpost, combo/XP, current scaffold level, a
"due lamps" counter, and a button to exit back to the React app. The verse
tiles occupy the center; the path stretches behind/around them. On mobile the
HUD collapses to icons; tiles are thumb-reachable in the lower 60% of the
screen.

---

## 6. Moment-to-moment gameplay — the recall mechanic

This is the heart of the design. It must be (a) fun on touch *and* mouse, (b)
scale from recognition to true free recall, and (c) reuse the existing
`timesRecited`-based ladder so it integrates with current progress.

### 6.1 The tile mechanic (touch + mouse native)

The verse is broken into **word tiles** (same tokenization as Word Bank /
`buildWordBank`). The player **drags tiles into a sentence tray** to reconstruct
the verse. Drag is the same gesture for mouse (click-drag) and touch
(press-drag), so the mechanic is input-agnostic by construction — no separate
control schemes to maintain.

What makes it a *game* and not a worksheet:

- **Physics & juice.** Tiles have weight: they ease into the tray with a soft
  bounce, snap to slots with a magnetic feel, and nudge neighbors aside. A
  wrong placement *doesn't* lock in — the tile jiggles red and slides back to
  the bank, so the player self-corrects in flow (no "you failed" hard stop).
- **Bank shrinks as you place.** Each placed tile leaves the bank, so the
  remaining problem gets visually simpler — a satisfying convergence.
- **Slot affordance.** The tray shows faint slot guides sized to each word,
  giving just enough structure without giving the answer.

> **Design revision — tap-only, no typing, no voice.** The original v1 design
> had higher scaffold levels hide words, show first letters, or require
> typing/voice. That fails the brief: on a phone there is no comfortable
> keyboard, and in most environments the player cannot speak aloud. The game
> is now **tap/drag-only at every stage**. Difficulty scales *only* by adding
> **decoy (wrong) words** to the tile bank — never by hiding words, showing
> first letters, or asking the player to type. A future revision may add
> multi-verse "chain" reconstruction (see §6.6) as an additional difficulty
> axis; it will also remain tap-only.

### 6.2 The scaffold ladder (tap-only; difficulty = decoy count)

The game reuses the `timesRecited`-based ladder so a verse the player has
never seen starts easy and gets harder as they master it. Each stage is
clearly explained to the player, including how many decoy words have been
added. **Every stage is tap/drag-only — no typing, no voice, no hidden words:**

| Stage | Name | What the player sees | Decoys |
|---|---|---|---|
| **0** | Read | Full verse shown, tiles pre-placed in order; player reads and taps to continue | 0 |
| **1** | Order | All word tiles visible, shuffled; tap/drag into order | 0 |
| **2** | Order + decoys | Tap/drag into order, with 2 wrong words mixed into the bank | 2 |
| **3** | Order + decoys | …4 wrong words mixed in | 4 |
| **4** | Order + decoys | …6 wrong words mixed in | 6 |
| **5** | Order + decoys | …8 wrong words mixed in | 8 |

The stage for a verse is decided by `getGameLayer(timesRecited, customLevel,
status)` in `src/game/scaffold.ts`: a player-chosen override (`customClozeLevel`,
0–5) **always wins** — even over `mastered` — so the player can drop any verse
back to any stage, including stage 0, and have it remembered (mirrors the
Vanishing Cloze override, now extended to cover stage 5). Otherwise a `mastered`
verse is presented at stage 5; failing that the stage auto-advances with
`timesRecited` (0→0, 1–2→1, 3–4→2, 5–6→3, 7–9→4, 10+→5). Decoys are drawn from
the pool of all unlocked verses' words via a seeded PRNG so a given puzzle is
reproducible.

### 6.3 The fluency timer (the missing ingredient)

A soft, non-punishing timer creates flow and pushes recall toward automaticity:

- Each lamp has a **gentle glow ring** that depletes over ~20–40s (scaled by
  verse length and the player's average speed, so it's never unfair).
- Finishing before the ring empties awards a **Fluent** bonus (extra XP, combo
  +1, a brighter flare). Running out does *not* fail you — the ring just fades
  and you finish for base XP. **No fail state from time.**
- This is deliberately unlike a stressful countdown: it's a "can you do it
  smoothly?" beat, not a "hurry or lose" beat. It adds the automaticity
  dimension the app currently lacks without making the game anxious.

### 6.4 Voice recite — DROPPED

Voice recite was originally planned for mobile free recall. It has been
**dropped entirely**: most players are rarely in an environment where they
can speak aloud to their phone without disturbing others, and the game is now
tap-only at every stage (§6.2). There is no voice/typing entry path in the
game, no Web Speech dependency, and no `voice` setting. Reciting aloud
remains a good memorization technique a player can do on their own — the game
simply does not require or score it.

### 6.5 Combo & flow

Consecutive correct lamps build a **combo** that multiplies XP and makes the
visuals livelier (brighter flares, faster parallax, a rising melodic chime).
A wrong answer resets combo to 0 but nothing else — combos are a *reward for
mastery*, not a punishment for failure, keeping the mood encouraging (matching
the app's existing "Keep practicing" tone).

### 6.6 Future difficulty axis — multi-verse "chain" reconstruction (not yet built)

Decoy count is the only difficulty axis in v1. A second, still-tap-only axis is
planned: at the highest levels, instead of one verse the player reconstructs a
short **chain** of consecutive verses (e.g. *Psalm 23:1 → 23:2 → 23:3*) from a
single mixed bank — more words, more decoys, and the player must also recover
verse boundaries. This rewards players who want a harder challenge without
reintroducing typing, voice, or hidden words. It is documented here as a
future enhancement; the current implementation is decoy-escalation only
(stages 0–5).

---

## 7. Verse selection & mastery-gated expansion (not a fixed 40)

This directly answers the brief: the pool must **grow with mastery instead of
being capped at the curated 41**.

### 7.1 The unlock frontier

The path is divided into **regions**, each region = a set of verses. Regions
unlock based on how many lamps the player keeps *lit* (mastered), not how many
they've seen:

- **Region 1 — "The Gate"**: the curated "easy" verses (existing
  `difficulty: 'easy'`), ~the first 10–15. Always available.
- **Region 2 — "The Hills"**: unlocks when ≥N lamps in Region 1 are *mastered*
  (not just practiced). Adds the `medium` verses.
- **Region 3 — "The River"**: unlocks at more masteries; adds `hard` verses.
- **Region 4+ — "The Wilderness" / "The City"**: unlocks progressively; pulls
  from **the full Bible** via the existing `getKJVVerse` loader and the
  player's bookmarks (so the player can *choose* what to add — e.g. "light the
  whole of Psalm 23" as a region).

Because unlocks require *mastery* (streak ≥5, accuracy ≥90), the pool is always
exactly as large as the player can keep alive — the central design requirement.
A player who races ahead without mastering finds the frontier stops advancing,
naturally enforcing "learn deeply before learning more."

### 7.2 What gets practiced each session

The game's "next lamp" selector reuses the existing session-order logic
(`verses` useMemo in `Practice.tsx` L1443) so it behaves consistently with the
rest of the app:

1. **Due reviews first** — lamps whose `nextReview` has passed (flickering in
   the world). Re-lighting them is the day's main job.
2. **Least-practiced new verses** — `timesRecited` ascending, within the
   unlocked frontier.
3. **Daily goal** — the session naturally wraps when the daily goal
   (`kjv-memorize-daily-goal`) is met, with a celebratory "path lit for today"
   beat.

### 7.3 Player-curated expansion (the key to "as many as possible")

Because the full Bible is already available via `getKJVVerse` and bookmarks,
the game exposes a **"Build a road"** panel: the player picks a chapter, psalm,
or range they want to memorize (e.g. *Romans 8*, *Psalm 23:1-6*, *the Sermon on
the Mount*). Those verses become a new **branch** off the main path, unlocked
for practice immediately but gated to *mastery* for counting toward the next
region. This turns "I want to memorize Romans 8" into "build the Romans 8
spur road and light it lamp by lamp" — the spatial structure gives long
passages a tangible shape and a clear progress bar (lamps lit / total).

This is how the game scales **from 41 verses to 24,857**: the curated set is
just the starter road; every bookmarked range becomes a buildable branch, and
mastery — not an arbitrary cap — decides how much is active at once.

---

## 8. Integration with spaced repetition & due reviews

The game does **not** invent a new schedule. It reuses the existing one,
silently, underneath the per-session lamp journey:

- **Per-session lamps.** The lamps on the path are a *session* journey, not a
  lifetime map: all start unlit and light as you play through ~10–12 verses.
  Starting a new session lights a fresh set. Lifetime mastery and due state
  are tracked underneath but are **not** painted on the path (this avoids the
  confusion of a verse appearing "already lit" on a fresh game).
- **Due reviews still drive ordering.** The session's verse queue is still
  built due-first, then least-practiced (§7.2), so re-lighting due verses is
  the day's main job — the lamps just no longer visually *dim* in the world.
  Re-lighting a due verse calls the existing `useUpsertReviewScheduleMutation`
  to push `nextReview` out by the streak-based interval.
- **Per-verse progress is unified.** Every resolved lamp calls
  `useUpdateProgressMutation` with `correct: boolean`, so `timesRecited`,
  `streak`, `accuracy`, and `status` update identically to the other modes.
  A verse mastered in the game is mastered in Word Bank, and vice versa.

---

## 9. Scoring, XP, levels & progression

The app currently has **no XP/levels**. The game introduces a *local, cosmetic*
progression layer that does **not** replace the mastery ladder — it sits on top
of it as motivation:

- **XP per lamp**: base by verse length + scaffold layer (higher layer = more
  XP, rewarding harder recall) + fluency bonus + combo multiplier.
- **Player level** (cosmetic title): "Pilgrim → Scribe → Watchman → Lampbearer
  → Light of the World" etc. Purely flavor; shown in HUD, no gameplay gates
  beyond the mastery frontier.
- **Combo** as in §6.5.
- **Session record**: on exit or daily-goal completion, the game writes one
  `useCreateSessionMutation` record with `mode: 'fill-blank'` (or a new
  `'game'` bucket if you extend the union) and the verses practiced, so it
  appears in Statistics alongside other sessions.
- **Per-verse progress**: every resolved lamp calls `useUpdateProgressMutation`
  with `correct: boolean`, exactly like the other modes — so `timesRecited`,
  `streak`, `accuracy`, and `status` update identically. A verse mastered in
  the game is mastered in Word Bank, and vice versa. **Unified progress is a
  hard requirement, not a nice-to-have.**

**No pay-to-win, no energy, no currencies, no grinding gates** — XP is
feedback, not a resource you can run out of. This preserves the app's
no-monetization, no-dark-patterns ethos.

---

## 10. Game sub-modes

Three selectable ways to play the same core, chosen from the mode selector
alongside the existing 7 (so the game is "a mode," entered from `/practice`):

1. **Journey (default).** The described path experience; walks due reviews +
   new verses in order; the relaxed, stewardship mode. Good for daily practice.
2. **Lantern Race.** A timed sprint: as many lamps as possible in 60/120s,
   drawn from the player's *mastered* set (so it's pure fluency/automaticity
   review, no new material). Builds speed and the satisfying "I can rattle off
   20 verses" feeling. Combo or die (metaphorically — wrong = combo reset).
3. **Build a Road.** The player-curated expansion mode (§7.3): pick a passage,
   light it lamp by lamp. This is the mode for *adding* verses beyond the
   curated set — the direct answer to "memorize as many as possible."

All three write to the same progress/sessions/achievements plumbing.

---

## 11. Engine choice: Godot vs Babylon Lite

The brief offers Godot or "Babylon Lite." For this specific game — **2D,
text-heavy, embedded in a static React site, must run well on mobile touch** —
the recommendation is **Babylon Lite (Babylon.js, tree-shaken 2D build)**.

| Criterion | Godot 4 (HTML5 export) | Babylon Lite (Babylon.js 2D) | Winner here |
|---|---|---|---|
| Integration into React/Vite static site | Separate export pipeline; embed via `<iframe>` or canvas; own engine JS | Pure JS/TS lib; import as a module; boots into a `<canvas>` ref | **Babylon** |
| Bundle / cold load on mobile | Multi-MB export, slower boot | Small tree-shaken 2D build, fast | **Babylon** |
| Text & GUI legibility | GDScript RichTextLabel / GUI; HTML5 text/IME historically clunky | Built-in GUI; can even overlay DOM text for crispness | **Babylon** |
| Direct `localStorage` access | Awkward across iframe boundary; needs a message bridge | Native — same JS context as the app | **Babylon** |
| 2D physics/drag | Fine | Fine (or hand-rolled; drag doesn't need a physics engine) | Tie |
| 3D richness if you later want it | Excellent | Good (Babylon is 3D-capable) | Godot (slight) |
| Team skill / tooling | Needs Godot editor + GDScript | TS/JS, same as the repo | **Babylon** |

**Recommendation:** **Babylon Lite for v1.** It keeps everything in the repo's
language (TS), integrates as a normal module (no iframe, no export pipeline),
reads `localStorage` directly, and is small and fast on mobile. Godot becomes
the right choice only if you decide you want a genuinely 3D world with
authoring-heavy scenes and are willing to accept the heavier export and an
iframe bridge for storage. A 3D Godot version is listed in §19 as a possible
future "premium" variant.

> Note on "Babylon Lite": treat this as a tree-shaken, 2D-only Babylon.js
> setup (Babylon.js 7+ supports minimal core + `@babylonjs/gui` + 2D
> primitives, no full 3D engine import). If a distinct "Babylon Lite" product
> exists by the time you build, the integration story is the same — it's a JS
> library you import.

---

## 12. Technical integration into the React app

The game is a **new practice mode**, not a separate site. Concretely:

- **New route + component.** Add `src/components/Game.tsx` and a route in
  `src/App.tsx` (e.g. `/practice/game` or a query param on `/practice`). The
  mode selector in `Practice.tsx` gains an 8th card: **"Lamp of the Path
  (game)"** with a flame icon, marked "New."
- **Mounting.** `Game.tsx` renders a full-viewport `<canvas ref>` and, in a
  `useEffect`, imports the Babylon module and boots the scene. The React layer
  owns the chrome (exit button, settings, theme sync) and passes the current
  theme + verse pool + due list into the engine; the engine owns the canvas.
- **No iframe.** Because Babylon is a JS module, it shares the page's JS
  context and can call the existing hooks directly. (If you later pick Godot,
  switch to an `<iframe>` + `postMessage` bridge for storage/progress.)
- **Lazy-loaded.** The Babylon bundle is code-split (`React.lazy`) so it never
  weighs on the first load of the rest of the app — only downloaded when the
  player opens the game. This keeps the site's "instant static page" feel.
- **Theme sync.** The engine reads `kjv-theme` (and listens to the
  `kjv-storage-change` event from `src/hooks.ts`) so toggling dark mode with
  `t` re-skins the game live, matching the rest of the app.
- **Exit.** Returning to `/practice` unmounts the canvas and disposes the
  Babylon scene to free memory (important on mobile).

---

## 13. Data model & localStorage integration

The game adds **no new mandatory keys** — it reuses what exists. The only
addition is one optional key for game-only cosmetics:

- **Reused (read/write via `src/hooks.ts` mutations):**
  - `kjv-memorize-progress` — per-verse `status/streak/accuracy/timesRecited/
    customClozeLevel` (game reads to render lamp states, writes on each
    resolve).
  - `kjv-memorize-review-schedule` — `nextReview` per verse (game reads to
    compute dimming, writes on re-light).
  - `kjv-memorize-sessions` — one session record per play.
  - `kjv-memorize-achievements` — award via `useAwardAchievementMutation`.
  - `kjv-memorize-bookmarks` — source for "Build a Road" branches.
  - `kjv-memorize-daily-goal` — game respects and increments it.
- **New (optional, cosmetic only):**
  - `kjv-game-state` — `{ xp, level, comboBest, unlockedRegions[],
    builtRoads[], settings: {sound, motion} }` (voice was dropped — §6.4). If
    absent, the game derives everything from `kjv-memorize-progress` (so even
    with a fresh browser, a player who already mastered verses elsewhere sees
    the right lamps lit). This key is included in `settingsTransfer`
    export/import so it travels with the rest of the user's data.

This means **a verse mastered in any of the 7 existing modes contributes to
the game's region unlocks and session ordering**, and vice versa — unified
progress by construction. (The lamps themselves are per-session, not a
mastery map — see §8.)

---

## 14. Achievements integration

Reuse the existing 10 badges and wire the two that are currently *defined but
not awarded*:

- `master-level` ("Master of the Word") — already awarded by `handleComplete`;
  the game awards it identically when a lamp first reaches `mastered`.
- `book-complete` ("Book Master") and `testament-complete` ("Testament Hero")
  — **currently dead code.** The game's "Build a Road" mode makes these
  naturally awardable: complete a whole book's worth of lamps → `book-complete`;
  complete all books of a testament → `testament-complete`. This finally
  activates them and gives long-haul players epic goals.
- Plus a few **game-specific** badges (add to `ACHIEVEMENT_INFO`): "Pathfinder"
  (first road built), "Lantern Race champion" (20-lamp sprint), "City on a
  Hill" (100 lamps lit), "Light of the World" (all 41 curated mastered). All
  awarded through the same `useAwardAchievementMutation`.

---

## 15. Accessibility, performance & offline

- **Tap/drag play.** Mouse and touch share the same tap/drag tile mechanic, so
  the game is input-agnostic by construction — no on-screen keyboard, no
  voice, no separate control schemes to maintain. The whole game is playable
  with a single pointer.
- **Reduced motion.** Respect `prefers-reduced-motion`: disable parallax,
  shorten flares, kill screen shake. The game remains fully playable.
- **Text size.** Honor `kjv-verse-font-size` for tile text, so the player's
  existing preference carries in.
- **Color-blind safe.** Lamp states use shape + label (lit/unlit icons) in
  addition to color, not color alone.
- **Performance.** 2D Babylon, few dozen sprites, no per-frame heavy work;
  target 60fps on mid-range phones. Dispose scene on unmount. Cap DPR at 2 to
  avoid retina fill blowups.
- **Offline.** The app is already static and works offline once cached; the
  Babylon bundle is just another static asset. Verse data already ships as
  static JSON / `kjv.txt`. The game works fully offline, consistent with the
  privacy/no-backend promise. (No voice dependency remains.)

---

## 16. Sound & "juice"

The app currently has **no sound**. The game introduces optional, off-by-default
sound (toggle in HUD + `kjv-game-state.settings.sound`):

- Soft chime on a lit lamp, rising pitch with combo.
- A gentle "flicker" tick when a due lamp comes into view (subtle reminder).
- Ambient pad (very low) for the landscape — off by default, easily muted.
- Haptic feedback on mobile (navigator.vibrate) on lamp-light, if permitted.

All non-essential; the game is fully playable silent. This keeps the app's
restrained character while letting the game *feel* like a game.

---

## 17. Privacy & monetization

Inherits the app's ethos exactly: **no ads, no tracking, no accounts, no
backend, no analytics, all data in `localStorage`.** The game adds no network
calls. XP/levels are local cosmetics, not a currency. No leaderboards (would
require a backend and break the privacy promise). This is non-negotiable and
the design above respects it fully.

---

## 18. Phased build roadmap

A suggested sequence so the game is useful at every step, not just at the end:

- **Phase 0 — Spike.** Stand up a Babylon 2D canvas in a `Game.tsx` route,
  render a single verse as draggable tiles, score against
  `checkWordBankAnswer`, write progress via `useUpdateProgressMutation`.
  Deliverable: a playable, ugly-but-real tile mode that unifies with existing
  progress. (This alone is a useful 8th mode.)
- **Phase 1 — The path.** Add the scrolling landscape, lamp placement, the
  tap-only scaffold ladder (stages 0–5) driven by `timesRecited`, per-session
  lamps, and the Journey sub-mode. Deliverable: the core stewardship loop.
- **Phase 2 — Fluency.** Add the gentle timer, combo, XP/level cosmetics,
  sound + juice, the session-summary overlay, and the stage-control UI.
  Deliverable: the "game feel."
- **Phase 3 — Expansion.** "Build a Road" (bookmark/full-Bible branches),
  mastery-gated region unlocks, Lantern Race sub-mode. Deliverable: scales
  beyond 41 verses and finally awards `book-complete` /
  `testament-complete`.
- **Phase 4 — Chain (future).** Multi-verse "chain" reconstruction (§6.6) as
  an additional, still-tap-only difficulty axis. Deliverable: a harder
  challenge for advanced players without typing or voice.
- **Phase 5 — Polish/3D option.** Reduced-motion, full a11y pass, optional
  Godot 3D variant as a premium toggle if desired.

Each phase is independently shippable and each leaves the existing 7 modes
untouched.

---

## 19. Alternative concepts considered

These were weighed before settling on "Lamp of the Path":

- **Falling-word / Tetris-style verse builder.** Words drop; you catch/place
  them to build the verse. Very fun, very mobile. Rejected as primary because
  the time pressure is *punishing* (a fail state) and it favors recognition
  over recall — the opposite of the memory goal. Could reappear as a limited
  Lantern Race variant.
- **3D first-person memory palace.** Walk a 3D room; place verses on walls.
  Strongest *spatial encoding* of the options. Rejected for v1 because 3D
  text legibility, Godot HTML5 load time, and mobile thermal/perf cost fight
  the app's lean ethos. Listed as Phase 5 / Godot variant.
- **Verse battle / card battler.** Collect verse "cards," battle by recalling.
  Engaging but adds a competitive/win-lose frame that clashes with the
  contemplative tone and risks the mechanics overshadowing the memorization.
- **Typing-racer for verses.** Type the verse as fast as possible. Great
  fluency drill, but duplicates Full Recall with a timer and is painful on
  mobile keyboards. Folded the good part (fluency timer) into the main design
  instead.

"Lamp of the Path" wins because it uniquely combines *all four* memory levers
(active recall, spaced repetition, spatial encoding, fluency) while reusing
the app's existing mastery ladder and storage, scaling to the whole Bible via
mastery-gated expansion, and being equally playable on touch and mouse.

---

## 20. Risks & open questions

- **Babylon bundle size.** Even tree-shaken, Babylon adds KBs. Mitigation:
  code-split + lazy load only when the game is opened; benchmark on mobile
  before committing. If unacceptable, a hand-rolled Canvas2D implementation of
  the same mechanic is viable (the drag/tile logic needs no engine).
- **Decoy-pool scaling.** Decoys are drawn from all unlocked verses' words; as
  the pool grows, ensuring decoys are plausibly "wrong" (not accidentally the
  verse's own words, not trivially rejectable) needs the normalized exclusion
  in `pickDecoys`. Mitigation: seeded PRNG for reproducibility; degrade
  gracefully (fewer decoys) when the pool is small.
- **Unifying `mode` in session records.** The existing union collapses to
  `'recall' | 'multiple-choice' | 'reference' | 'fill-blank'`. Decide whether
  to add a `'game'` bucket (cleaner stats) or map to `'fill-blank'` (no schema
  change). Recommend adding `'game'` for honest Statistics.
- **"Babylon Lite" identity.** Confirm whether a distinct "Babylon Lite"
  product exists at build time or whether this means a tree-shaken Babylon.js
  2D build; integration is the same either way.
- **Mastery-gated pacing feel.** The unlock thresholds (how many mastered
  lamps before the next region) need playtesting so the frontier doesn't feel
  either grindy or trivially fast. Start conservative; tune from session data
  (which the app already records).
- **3D temptation.** Resist 3D in v1 for the text-legibility and perf reasons
  above; keep it as an optional later variant.

---

### One-paragraph pitch

*Lamp of the Path* is a 2D, full-page Babylon Lite game that turns the app's
mastery ladder into a tactile **tap-or-drag the words into order** recall
mechanic — equally fun on a phone and a mouse, with **no typing and no voice at
any stage** — and lays every verse you play in a session down as a lit lamp
along a walking path through a scriptural landscape. Difficulty scales by
adding decoy (wrong) words to the bank, the lamps are a fresh per-session
journey to light, and new verses unlock only as you master what you have — so
the pool scales from the curated 41 all the way to the whole Bible without ever
overwhelming you. It plugs into the exact same `localStorage` progress,
sessions, achievements, and spaced-repetition schedule as the other seven
modes, so a verse mastered in the game is mastered everywhere — a true eighth
practice mode, not a separate app.