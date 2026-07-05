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
bun run dev          # Vite dev server at http://localhost:3000
```

## Build

```bash
bun run build        # tsc + vite build -> ./dist
bun run preview      # serve ./dist at http://localhost:4173/kjv-ref/
```

## Unit tests

```bash
bun run test:run     # single run (192 tests, ~2s)
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

Run before pushing to `main` (pushing triggers the live GitHub Pages deploy):

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

## Deployment

Automatic on push to `main` via `.github/workflows/deploy.yml` (runs
`bun install` + `bun run build`, publishes `./dist` to GitHub Pages at
`https://gmlewis.github.io/kjv-ref/`). No manual deploy step.

## Do not

- Do not create a `package-lock.json` — this repo uses `bun.lock`.
- Do not run `npm install` or commit `node_modules`.
- Do not commit `dist/` or `e2e/report/`.
- Do not add external backend dependencies — all data is served statically.
