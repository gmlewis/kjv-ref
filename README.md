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
- **Spaced repetition:** SM-2 algorithm schedules reviews at increasing intervals
- **Strong's Concordance:** tap any word for Hebrew/Greek lexicon data
- **Interlinear text:** side-by-side original language with English
- **Full-text search** across all 31,102 KJV verses
- **Bookmarks** — save verses for focused practice
- **Daily goals** — track your memorization streak
- **Achievements** — earn badges for milestones
- **Dark mode** — toggle in the nav bar
- **Keyboard shortcuts** — `Ctrl+K` for search, `1-4` for multiple choice
- **Verse sharing** — copy direct links to any verse
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

Uses [Vitest](https://vitest.dev) with jsdom. 192 tests across 13 files.

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
| `src/utils/bibleBooks.test.ts` | Book metadata, prev/next chapter |
| `src/utils/bookmarkHelpers.test.ts` | Bookmark logic |
| `src/utils/studyLinks.test.ts` | BibleHub / STEP Bible links |
| `src/utils/urlHelpers.test.ts` | URL helpers |
| `src/components/StrongsPopover.test.tsx` | Strong's popover component |
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
| `e2e/navigation.spec.ts` | Nav bar, all 5 sections, mobile hamburger |
| `e2e/dashboard.spec.ts` | Hero, stat cards, featured verses, CTAs |
| `e2e/practice.spec.ts` | Mode selector, Word Bank, First Letters, Vanishing Cloze, Multiple Choice, Reference Match, session summary, progress tracking |
| `e2e/books.spec.ts` | Books grid, Old/New filter, search, book detail, chapter view, featured verses |
| `e2e/stats-achievements.spec.ts` | Statistics page, Achievements page |

---

## Full pre-deploy confidence check

Run this sequence before pushing to `main` (which triggers the live deploy):

```bash
bun install              # clean install
bun run test:run         # 192 unit tests
bun run build            # production build
bun run e2e              # e2e tests against the built bundle
```

If all four pass, the GitHub Pages deploy will succeed — the CI workflow runs
the same `bun install` + `bun run build`.

---

## Deployment

Deployment is **automatic**. Pushing to `main` triggers
`.github/workflows/deploy.yml`, which runs `bun install` + `bun run build` and
publishes `./dist` to GitHub Pages. The site goes live at
`https://gmlewis.github.io/kjv-ref/`.

There is no manual deploy step.

### GitHub Pages setup (one-time repo config)

1. **Repository → Settings → Pages:** set "Build and deployment" source to
   **GitHub Actions** (not "Deploy from a branch"). The workflow in
   `.github/workflows/deploy.yml` handles the rest.
2. The default branch must be `main`. If your default branch is `master`, either
   rename it or update the `on.push.branches` in `deploy.yml`.

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

All user data lives in `localStorage` under the `kjv-memorize-*` keys (kept for
compatibility with existing users' saved progress):

- `kjv-memorize-progress` — per-verse: `timesRecited`, `status`, `streak`, `accuracy`
- `kjv-memorize-sessions` — each practice session: score, mode, verses
- `kjv-memorize-achievements` — earned badges
- `kjv-memorize-bookmarks` — saved verses
- `kjv-memorize-daily-goal` — daily target and completion
- `kjv-memorize-review-schedule` — SM-2 spaced repetition schedule

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
│   │   ├── Practice.tsx    # All practice modes
│   │   ├── Books.tsx       # Browse / chapter view
│   │   ├── Dashboard.tsx
│   │   ├── Statistics.tsx
│   │   ├── Achievements.tsx
│   │   ├── Navigation.tsx
│   │   ├── StrongsPopover.tsx
│   │   └── InterlinearWordPopover.tsx
│   ├── data/
│   │   ├── kjv-bible.ts        # KJV parser + lazy loader
│   │   ├── kjv-verses.ts       # Flat verse list
│   │   ├── kjv-search.ts       # MiniSearch full-text index
│   │   ├── strongs.ts          # Strong's lexicon lookup
│   │   ├── interlinear.ts      # Interlinear word mapping
│   │   └── dataUrls.ts         # Static URL registry (no-op for static site)
│   ├── utils/
│   │   ├── practiceHelpers.ts  # Word Bank, First Letters, Vanishing Cloze
│   │   ├── spacedRepetition.ts # SM-2 algorithm
│   │   ├── bibleBooks.ts       # Book metadata, prev/next chapter
│   │   ├── bookmarkHelpers.ts
│   │   ├── studyLinks.ts       # BibleHub / STEP Bible links
│   │   └── urlHelpers.ts
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
├── .github/workflows/deploy.yml  # GitHub Pages deploy (bun)
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

## Background

This is a fully static KJV Bible memorization app. All user data lives in
`localStorage`, all reference data is served as static JSON from `public/`,
and the site deploys automatically to GitHub Pages on push to `master`.
