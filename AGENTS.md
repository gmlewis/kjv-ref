# AGENTS.md

Commands and conventions for working in this repo. All commands use
[Bun](https://bun.sh) — do not use npm/yarn.

## Setup

```bash
bun install
bunx playwright install chromium   # one-time, for e2e
```

## Development

```bash
bun run dev          # Vite dev server at http://localhost:3000/kjv-ref/
./run.sh             # dev server + auto-opens Chrome tab
```

Note the `/kjv-ref/` base path — the bare root answers 302 with an empty body.

`vite.config.ts` sets `server.strictPort: true`, so a dev server that cannot
claim port 3000 exits rather than silently moving to 3001. Without it, a stray
dev server left running from an earlier session keeps 3000, the new one is
quietly pushed to 3001, and the browser ends up talking to the stale one — which
also serves a months-old module graph whose dep-optimizer URLs no longer match
`node_modules/.vite` (it shows up as `504 (Outdated Optimize Dep)` on `recharts`
and `lucide-react`). If you hit that, find the squatter with
`lsof -nP -iTCP:3000 -sTCP:LISTEN` and clear the cache with
`rm -rf node_modules/.vite`.

## Build

```bash
bun run build        # tsc + vite build -> ./dist
bun run preview      # serve ./dist at http://localhost:4173/kjv-ref/
```

## Unit tests

```bash
bun run test:run     # single run
bun run test         # watch mode
```

All unit tests must pass before pushing.

## E2e tests

```bash
bun run e2e          # auto-builds + serves ./dist, then runs Playwright
bun run e2e:headed   # same, with visible browser
```

The Playwright config (`playwright.config.ts`) auto-starts `vite preview` on
port 4173 with the `/kjv-ref/` base path. No auth setup is needed.

## Pre-deploy confidence check

Run before pushing to `master` (pushing triggers the live GitHub Pages deploy):

```bash
bun install && bun run test:run && bun run build && bun run e2e
```

## Lint / typecheck

There is no separate lint command. TypeScript type-checking runs as part of
`bun run build` (`tsc && vite build`). If the build passes, the types are clean.

## Known LSP false positive

`vite.config.ts` may show an LSP error: `'test' does not exist in type
'UserConfigExport'`. This is a known false positive — the `test` field is
provided by Vitest's type augmentation and is valid at build time. `bun run
build` succeeds regardless. Do not "fix" this by removing the `test` field.

## CI

The `on-push-or-pr` workflow (`.github/workflows/ci.yml`) runs on push to
`master` and on PRs:
- `build-and-test` job: `bun install` + `bun run build` + `bun run test:run`
- `e2e` job (push only): `bun install` + `bun run build` + `bun run e2e`

Both `Setup Bun` steps retry up to 3 times with exponential backoff (10s,
then 20s waits) to absorb transient GitHub release-asset CDN outages (504s).

Note: e2e tests only run on push to `master`, not on PRs. Fix e2e test issues
before pushing to `master`.

## Deployment

Automatic on push to `master` via `.github/workflows/deploy.yml` (runs
`bun install` + `bun run build`, publishes `./dist` to GitHub Pages at
`https://gmlewis.github.io/kjv-ref/`). No manual deploy step.

## Do not

- Do not create a `package-lock.json` — this repo uses `bun.lock`.
- Do not run `npm install` or commit `node_modules`.
- Do not commit `dist/` or `e2e/report/`.
- Do not add external backend dependencies — all data is served statically.
- Do not forget to add a trailing newline to all source code and Markdown files.
