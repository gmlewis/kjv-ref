# KJV Memorize

A KJV Bible memorization app built on the [Prophet](https://preview.prophet.do) platform. Uses proven memorization techniques — Word Bank, First Letters, and Vanishing Cloze — backed by spaced repetition to help you retain scripture long-term.

---

## Prerequisites

- [Bun](https://bun.sh) — runtime and package manager
- [Prophet CLI](https://preview.prophet.do) — deploy and manage Prophet apps
- A Prophet account with access to the `kjv-memorize` app

---

## First-time setup

```bash
# 1. Install npm dependencies
bun install

# 2. Install the Prophet SDK (not on npm — fetched from the platform)
./scripts/setup.sh

# 3. Install Playwright's Chromium browser (needed for e2e tests)
bunx playwright install chromium
```

### What `scripts/setup.sh` does

- Installs the Prophet SDK into `node_modules/` from `https://preview.prophet.do/sdk/prophet-sdk.tgz`
- Regenerates TypeScript types from `kjv-memorize.prophet` via `prophet typegen`

---

## Local development

> **Note:** `bun run dev` shows a blank purple gradient with no content. This is expected — the app only renders inside a Prophet iframe (it requires a `prophet:config` postMessage handshake). There are no local backend emulators.

To develop, deploy to the preview environment and test there:

```bash
./scripts/deploy.sh "your commit message"
```

This builds, deploys, and promotes in one step. The app is immediately live at `https://preview.prophet.do/exp/kjv-memorize`.

---

## Build & deploy

### Manual steps

```bash
# Build the app
bun run build

# Deploy to Prophet (creates a new revision)
prophet deploy kjv-memorize.prophet \
  --app kjv-memorize \
  --assets ./dist \
  -m "your message"

# Promote the revision to live
prophet promote kjv-memorize <revision-number>
```

### One-liner

```bash
./scripts/deploy.sh "your message"
```

The deploy script prints the new revision number and promotes it automatically.

---

## Unit tests

Uses [Vitest](https://vitest.dev) with jsdom.

```bash
# Watch mode (re-runs on file changes)
bun run test

# Single run
bun run test:run

# With coverage report
bun run test:coverage
```

Key test files:

| File | What it covers |
|------|---------------|
| `src/data/kjv-bible.test.ts` | KJV parser — all 66 book abbreviations, verse lookup, chapter listing |
| `src/utils/practiceHelpers.test.ts` | Word Bank shuffle, First Letters hint, Vanishing Cloze blanking |

---

## End-to-end tests

Uses [Playwright](https://playwright.dev) against the **live deployed site** at `https://preview.prophet.do/exp/kjv-memorize`.

### One-time auth setup (Google OAuth)

Because the site uses "Sign in with Google", the easiest approach is to extract cookies directly from Chrome — no browser popup required:

```bash
./scripts/e2e-login.sh
# or equivalently:
bun run e2e:setup
```

This reads your existing authenticated session from Chrome's cookie database on macOS (decrypting via the macOS Keychain) and writes it to `e2e/.auth/state.json`. You must already be logged in on `preview.prophet.do` in Chrome.

To refresh at any time:

```bash
./scripts/e2e-login.sh
```

**Fallback** — if Chrome cookie extraction doesn't work, open a headed browser for manual sign-in:

```bash
./scripts/e2e-login.sh --manual
# or:
bun run e2e:setup:manual
```

> `e2e/.auth/state.json` is gitignored. If cookies expire just re-run `e2e-login.sh`.

### Running e2e tests

```bash
# All tests, headless (default)
bun run e2e

# All tests, headed (watch the browser)
bun run e2e:headed

# Interactive UI — pick and replay individual tests
bun run e2e:ui

# Single spec file
bunx playwright test e2e/practice.spec.ts --headed

# Single test by name
bunx playwright test --grep "Word Bank" --headed

# View the last HTML report
bun run e2e:report
```

### Test coverage (93 tests across 5 spec files)

| Spec file | Tests | What it covers |
|-----------|-------|----------------|
| `e2e/navigation.spec.ts` | 8 | Nav bar, all 5 sections, mobile hamburger |
| `e2e/dashboard.spec.ts` | 5 | Hero, stat cards, featured verses, CTAs |
| `e2e/practice.spec.ts` | 37 | Mode selector, Word Bank, First Letters, Vanishing Cloze, Multiple Choice, Reference Match, session summary, progress tracking |
| `e2e/books.spec.ts` | 20 | Books grid, Old/New filter, search, book detail, chapter view, featured verses |
| `e2e/stats-achievements.spec.ts` | 23 | Statistics page, Achievements page |

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

Spaced repetition (due reviews) are surfaced at the top of the practice queue and shown as a badge in the nav.

---

## Schema overview

The `kjv-memorize.prophet` file defines the data model:

- **`Verse`** — seeded from `kjv.txt`; 24,857 verses across 66 books
- **`UserProgress`** — per-user, per-verse; tracks `timesRecited`, `status`, `streak`, `accuracy`
- **`Session`** — records each practice session with score and mode
- **`ReviewSchedule`** — SM-2 spaced repetition schedule (`interval`, `easeFactor`, `dueDate`)
- **`Achievement`** — badges (First Steps, 7-Day Warrior, Master of the Word, etc.)
- **`DailyGoal`** — daily target and completion tracking

Regenerate TypeScript types after changing the schema:

```bash
prophet typegen kjv-memorize.prophet
```

---

## Project structure

```
kjv-memorize/
├── src/
│   ├── components/         # React UI components
│   │   ├── Practice.tsx    # All practice modes
│   │   ├── Books.tsx       # Browse / chapter view
│   │   ├── Dashboard.tsx
│   │   ├── Statistics.tsx
│   │   └── Achievements.tsx
│   ├── data/
│   │   ├── kjv-bible.ts    # KJV parser + lazy loader
│   │   └── kjv-bible.test.ts
│   ├── utils/
│   │   ├── practiceHelpers.ts   # Word Bank, First Letters, Vanishing Cloze
│   │   └── practiceHelpers.test.ts
│   └── types/
│       └── vite-env.d.ts
├── public/
│   └── kjv.txt             # Full KJV Bible text (fetched at runtime)
├── e2e/
│   ├── helpers/
│   │   └── app-frame.ts    # Playwright iframe helpers
│   ├── global-setup.ts     # One-time Google OAuth session capture
│   ├── navigation.spec.ts
│   ├── dashboard.spec.ts
│   ├── practice.spec.ts
│   ├── books.spec.ts
│   └── stats-achievements.spec.ts
├── scripts/
│   ├── setup.sh            # Install SDK + regenerate types
│   ├── deploy.sh           # Build + deploy + promote
│   └── e2e-login.sh        # Capture Google OAuth session
├── kjv-memorize.prophet    # Prophet schema (entities, mutations, shapes)
├── playwright.config.ts
├── vite.config.ts
└── package.json
```

---

## Scripts reference

| Script | Description |
|--------|-------------|
| `bun run dev` | Start Vite dev server (blank screen — expected, see above) |
| `bun run build` | TypeScript compile + Vite production build |
| `bun run test` | Unit tests in watch mode |
| `bun run test:run` | Unit tests, single run |
| `bun run test:coverage` | Unit tests with coverage report |
| `bun run e2e` | Playwright e2e tests, headless |
| `bun run e2e:headed` | Playwright e2e tests, headed |
| `bun run e2e:ui` | Playwright interactive UI |
| `bun run e2e:setup` | Capture Google OAuth session (one-time) |
| `bun run e2e:report` | Open last HTML test report |
| `./scripts/setup.sh` | Install Prophet SDK + regenerate types |
| `./scripts/deploy.sh "msg"` | Build + deploy + promote to live |
| `./scripts/e2e-login.sh` | Capture Google OAuth session for Playwright |
