# KJV Ref

A KJV Bible memorization app that runs entirely in the browser on GitHub Pages
at **[gmlewis.github.io/kjv-ref](https://gmlewis.github.io/kjv-ref)**.

### Privacy by design

- **No ads. No tracking. No data collection. No analytics.**
- **No accounts, no login, no cookies, no third-party services.**
- **All your data stays in your browser's `localStorage`** — it never leaves your device.
- **Fully open source** — inspect every line of code.

---

## Features

- **6 practice modes:** Word Bank, First Letters, Vanishing Cloze, Multiple Choice, Reference Match, Full Recall
- **Multi-verse ranges:** bookmark and practice verse ranges like "Psalms 23:1-6"
- **Spaced repetition:** SM-2 algorithm schedules reviews at increasing intervals
- **Strong's Concordance:** tap any word for Hebrew/Greek lexicon data
- **Interlinear text:** side-by-side original language with English, with clickable word popovers
- **Full-text search** across all 24,857 KJV verses with advanced syntax (phrases, wildcards, OR, exclude)
- **Fuzzy Bible reference search:** type `jn3:16`, `ps23`, or `1 john 2` to jump to any verse
- **Bookmarks** — save individual verses or verse ranges for focused practice
- **Settings export/import** — download all your data as JSON, share favorites with others
- **Daily goals** — track your memorization streak
- **Achievements** — earn badges for milestones
- **Dark mode** — toggle in the nav bar or with the `t` key
- **Keyboard shortcuts** — `?` for help, `/` for search, `←`/`→` for verse navigation, and more
- **Verse sharing** — copy direct links to any verse or verse range
- **Zero dependencies on external services** — all data is static JSON served from GitHub Pages

---

## Tech stack

- **Runtime/PM:** [Bun](https://bun.sh) 1.3+
- **Framework:** React 18 + TypeScript
- **Build:** Vite 5
- **Styling:** Tailwind CSS 3
- **Routing:** react-router-dom 7
- **Tests:** Vitest (unit), Playwright (e2e)
- **Deploy:** GitHub Pages (auto-deploy on push to `main`)

---

## Prerequisites

Install [Bun](https://bun.sh) (one-time):

```bash
curl -fsSL https://bun.sh | bash
```

Then verify:

```bash
bun --version   # should print 1.3.x or newer
```

For e2e tests, also install Playwright's browser (one-time):

```bash
bunx playwright install chromium
```

---

## First-time setup

```bash
bun install
```

That's it. No SDK to install, no platform account, no typegen step.

---

## Local development

```bash
bun run dev
```

The app renders fully in the local dev server — no iframe, no blank screen.
Open the URL Vite prints (typically `http://localhost:3000`).

> The Vite `base` is `/kjv-ref/` to match the GitHub Pages project path. In dev
> this is handled automatically by `import.meta.env.BASE_URL`, which the
> `BrowserRouter` uses as its `basename`.

---

## Build & preview locally

```bash
bun run build       # tsc + vite build -> ./dist
bun run preview     # serve ./dist locally
```

The preview server serves at `http://localhost:4173/kjv-ref/` — the same
subpath the live site uses. This is the best way to verify the production
bundle before pushing.

---

## Unit tests

Uses [Vitest](https://vitest.dev) with jsdom. 791 tests across 24 files.

```bash
bun run test          # watch mode (re-runs on file changes)
bun run test:run      # single run
bun run test:coverage # with coverage report
```

| Test file | What it covers |
|-----------|----------------|
| `src/data/kjv-bible.test.ts` | KJV parser — all 66 book abbreviations, verse lookup, chapter listing |
| `src/data/kjv-search.test.ts` | Full-text verse search (MiniSearch) |
| `src/data/strongs.test.ts` | Strong's lexicon lookup |
| `src/data/strongs-index.test.ts` | Strong's word index |
| `src/data/interlinear.test.ts` | Interlinear word mapping |
| `src/utils/practiceHelpers.test.ts` | Word Bank shuffle, First Letters, Vanishing Cloze |
| `src/utils/spacedRepetition.test.ts` | SM-2 review scheduling |
| `src/utils/bibleBooks.test.ts` | Book metadata, prev/next chapter, verse navigation |
| `src/utils/verseNav.test.ts` | Verse-level next/prev navigation with wraparound |
| `src/utils/bookmarkHelpers.test.ts` | Bookmark logic |
| `src/utils/studyLinks.test.ts` | BibleHub / STEP Bible links |
| `src/utils/urlHelpers.test.ts` | URL helpers, verse hash ranges |
| `src/utils/verseScroll.test.ts` | Verse hash scroll target parsing |
| `src/utils/bibleQueryParser.test.ts` | Advanced search expression parser (phrases, wildcards, OR, exclude) |
| `src/utils/bibleQueryEval.test.ts` | Bible query evaluator against real KJV data |
| `src/utils/bibleRefSearch.test.ts` | Fuzzy Bible reference search (abbreviations, ranges) |
| `src/utils/settingsTransfer.test.ts` | Settings export/import (bookmarks, round-trip, group bookmarks) |
| `src/components/StrongsPopover.test.tsx` | Strong's popover component |
| `src/components/InterlinearWordPopover.test.tsx` | Interlinear word popover, RTL positioning fix |
| `src/components/KeyboardModals.test.tsx` | Shortcuts modal, search modal |
| `src/components/Books.keyboard.test.tsx` | Keyboard shortcuts for verse/chapter navigation |
| `src/components/Practice.verse-count.test.ts` | Practice verse filtering |
| `src/components/Practice.range.test.ts` | Multi-verse range practice sessions |
| `scripts/build-interlinear-words.test.ts` | Interlinear build script |

---

## End-to-end tests

Uses [Playwright](https://playwright.dev). The config auto-builds the app and
starts a `vite preview` server, so a single command runs the full pipeline:

```bash
bun run e2e          # headless (auto-builds + serves ./dist)
bun run e2e:headed   # watch the browser
bun run e2e:ui       # interactive picker
bun run e2e:report   # open the last HTML report
```

Run a single spec or test:

```bash
bunx playwright test e2e/navigation.spec.ts --headed
bunx playwright test --grep "Word Bank" --headed
```

> **No auth setup needed.** The static site is fully public — there is no
> Google OAuth, no cookie extraction, no `e2e/.auth/state.json`.

| Spec file | What it covers |
|-----------|----------------|
| `e2e/navigation.spec.ts` | Nav bar, all 5 sections, mobile hamburger menu |
| `e2e/dashboard.spec.ts` | Hero, stat cards, featured verses, CTAs |
| `e2e/practice.spec.ts` | Mode selector, Word Bank, First Letters, Vanishing Cloze, Multiple Choice, Reference Match, session summary, progress tracking |
| `e2e/books.spec.ts` | Books grid, Old/New filter, search, book detail, chapter view, featured verses, chapter jump navigation |
| `e2e/stats-achievements.spec.ts` | Statistics page, Achievements page |

---

## Full pre-deploy confidence check

Run this sequence before pushing to `master` (which triggers the live deploy):

```bash
bun install              # clean install
bun run test:run         # 791 unit tests
bun run build            # production build
bun run e2e              # 93 e2e tests against the built bundle
```

If all four pass, the GitHub Pages deploy will succeed — the CI workflow runs
the same `bun install` + `bun run build`.

---

## Deployment

Deployment is **automatic**. Pushing to `master` triggers
`.github/workflows/deploy.yml`, which runs `bun install` + `bun run build` and
publishes `./dist` to GitHub Pages. The site goes live at
`https://gmlewis.github.io/kjv-ref/`.

There is no manual deploy step.

### GitHub Pages setup (one-time repo config)

1. **Repository → Settings → Pages:** set "Build and deployment" source to
   **GitHub Actions** (not "Deploy from a branch"). The workflow in
   `.github/workflows/deploy.yml` handles the rest.
2. The default branch must be `master`.

### Deep links

Deep links (e.g. `/kjv-ref/books/Genesis/1`) work on refresh thanks to the
`public/404.html` SPA fallback, which redirects back into the app and restores
the intended path via `history.replaceState` in `index.html`.

---

## Practice modes

| Mode | Description | When it appears |
|------|-------------|-----------------|
| **Word Bank** | Tap chips to assemble the verse | Always available |
| **First Letters** | Each word is shown as its first letter only | Always available |
| **Vanishing Cloze** | Words are progressively blanked out (0% → 25% → 50% → 75% → 100%) | Always available; blanking level scales with `timesRecited` |
| **Multiple Choice** | Pick the correct verse text from 4 options | Always available |
| **Reference Match** | Given the text, recall the reference | Always available |
| **Full Recall** | Type the verse from memory | Hidden behind "Show all modes" |

Spaced repetition (due reviews) are surfaced at the top of the practice queue
and shown as a badge in the nav.

---

## How data works (no backend)

All user data lives in `localStorage` under the `kjv-*` keys:

- `kjv-theme` — dark or light theme preference
- `kjv-verse-font-size` — verse display font size (adjustable with `+`/`-`)
- `kjv-strongs-enabled` — whether Strong's numbers are shown
- `kjv-interlinear-enabled` — whether interlinear text is shown
- `kjv-memorize-progress` — per-verse: `timesRecited`, `status`, `streak`, `accuracy`
- `kjv-memorize-sessions` — each practice session: score, mode, verses
- `kjv-memorize-achievements` — earned badges
- `kjv-memorize-bookmarks` — saved verses and verse ranges (e.g. "Psalms 23:1-6")
- `kjv-memorize-daily-goal` — daily target and completion
- `kjv-memorize-review-schedule` — SM-2 spaced repetition schedule

Settings can be exported to a JSON file and imported on another browser via the
download/upload buttons in the nav bar.

Cross-tab sync uses the browser `storage` event. The layer lives in
`src/storage.ts`; the React hooks that wrap it are in `src/hooks.ts`.

Reference data (the KJV text, Strong's lexicons, interlinear word mappings) is
served as static JSON from `public/` and fetched on demand — no file storage
service involved.

---

## Project structure

```
kjv-ref/
├── src/
│   ├── components/         # React UI components
│   │   ├── Practice.tsx    # All practice modes (single-verse + multi-verse ranges)
│   │   ├── Books.tsx       # Browse / chapter view / search panel / verse ranges
│   │   ├── Dashboard.tsx
│   │   ├── Statistics.tsx
│   │   ├── Achievements.tsx
│   │   ├── Navigation.tsx  # Nav bar + global keyboard shortcuts + settings export/import
│   │   ├── KeyboardModals.tsx  # ? shortcuts modal + / search modal
│   │   ├── StrongsPopover.tsx
│   │   └── InterlinearWordPopover.tsx
│   ├── data/
│   │   ├── kjv-bible.ts        # KJV parser + lazy loader
│   │   ├── kjv-verses.ts       # Flat verse list (curated ~41 verses)
│   │   ├── kjv-search.ts       # MiniSearch full-text index
│   │   ├── strongs.ts          # Strong's lexicon lookup
│   │   ├── interlinear.ts      # Interlinear word mapping
│   │   └── dataUrls.ts         # Static URL registry (no-op for static site)
│   ├── utils/
│   │   ├── practiceHelpers.ts  # Word Bank, First Letters, Vanishing Cloze
│   │   ├── spacedRepetition.ts # SM-2 algorithm
│   │   ├── bibleBooks.ts       # Book metadata, prev/next chapter, verse navigation
│   │   ├── bibleRefSearch.ts   # Fuzzy Bible reference search (abbreviations, ranges)
│   │   ├── bibleQueryParser.ts # Advanced search expression parser (phrases, wildcards)
│   │   ├── bibleQueryEval.ts   # Bible query evaluator against KJV text
│   │   ├── settingsTransfer.ts # Settings export/import (download/upload JSON)
│   │   ├── bookmarkHelpers.ts
│   │   ├── studyLinks.ts       # BibleHub / STEP Bible links
│   │   └── urlHelpers.ts       # URL helpers, verse hash ranges
│   ├── hooks.ts            # localStorage-backed React hooks
│   ├── storage.ts          # localStorage data layer
│   ├── App.tsx             # Router + routes
│   └── main.tsx            # React root
├── public/
│   ├── kjv.txt             # Full KJV Bible text (4.2 MB)
│   ├── interlinear/        # Hebrew/Greek interlinear (33 MB)
│   ├── strongs/            # Strong's lexicons (7.2 MB)
│   └── 404.html            # SPA fallback for deep links
├── e2e/                    # Playwright specs
│   ├── helpers/app-frame.ts
│   ├── navigation.spec.ts
│   ├── dashboard.spec.ts
│   ├── practice.spec.ts
│   ├── books.spec.ts
│   └── stats-achievements.spec.ts
├── scripts/                # Data-build scripts (interlinear, strongs index)
├── .github/workflows/
│   ├── ci.yml              # CI: build + test + e2e
│   └── deploy.yml          # GitHub Pages deploy
├── run.sh                  # Dev server + auto-open Chrome
├── vite.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

---

## Scripts reference

| Script | Description |
|--------|-------------|
| `bun run dev` | Start Vite dev server |
| `bun run build` | TypeScript compile + Vite production build |
| `bun run preview` | Serve the production build locally |
| `bun run test` | Unit tests in watch mode |
| `bun run test:run` | Unit tests, single run |
| `bun run test:coverage` | Unit tests with coverage report |
| `bun run e2e` | Playwright e2e tests (auto-builds + serves) |
| `bun run e2e:headed` | Playwright e2e tests, headed |
| `bun run e2e:ui` | Playwright interactive UI |
| `bun run e2e:report` | Open last HTML e2e report |
| `bun run parse` | Re-parse `kjv.txt` into verse data |

---

## Keyboard shortcuts

Press `?` anywhere in the app to see the full list. Key shortcuts:

| Key | Action |
|-----|--------|
| `?` | Show keyboard shortcuts help |
| `/` | Open full-Bible search dialog (with fuzzy reference jump) |
| `→` / `←` | Next / previous verse (wraps across chapters and books) |
| `Shift+→` / `Shift+←` | Jump to last verse / verse 1 of current chapter |
| `⌘→` / `⌘←` | Next / previous chapter |
| `g` | Go to the book list |
| `t` | Toggle dark / light theme |
| `+` / `−` | Increase / decrease verse text size |
| `Home` / `End` | Scroll to top / bottom of page |
| `Esc` | Close any dialog or popover |

---

## Background

This is a fully static KJV Bible memorization app. All user data lives in
`localStorage`, all reference data is served as static JSON from `public/`,
and the site deploys automatically to GitHub Pages on push to `master`.
