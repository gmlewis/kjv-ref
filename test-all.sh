#!/usr/bin/env bash
#
# test-all.sh — run the unit/component test suite (Vitest) once, no watch.
#
# This is a thin wrapper around `bun run test --run` (i.e. `vitest --run`).
# Any args you pass are forwarded straight to Vitest, so you can filter,
# report, and bail exactly the way you want. `--run` is already baked in,
# so the suite always exits after one pass (it never drops into watch mode).
#
# Note: this runs the UNIT/component tests only. For the Playwright browser
# suite, use `bun run e2e` (or `bun run e2e:headed` to watch it).
#
# ─── Suggested invocations ────────────────────────────────────────────────────
#
# Run the whole suite (default):
#   ./test-all.sh
#
# Run a single test file (fastest tight loop while iterating):
#   ./test-all.sh src/utils/bibleQueryEval.test.ts
#
# Run every test file under a directory:
#   ./test-all.sh src/utils
#
# Run only tests whose name matches a pattern (-t / --testNamePattern):
#   ./test-all.sh -t "highlight"
#   ./test-all.sh --testNamePattern="exact phrase"
#
# Stop at the first failure so you get feedback ASAP (--bail <number>):
#   ./test-all.sh --bail 1
#
# Combine filters for the tightest possible iteration loop — one file,
# one test name, stop on first failure:
#   ./test-all.sh src/components/Books.keyboard.test.tsx -t "left arrow" --bail 1
#
# Verbose reporter (prints every test name, not just a summary):
#   ./test-all.sh --reporter=verbose
#
# Update snapshots (-u / --update):
#   ./test-all.sh -u
#
# Collect coverage:
#   ./test-all.sh --coverage
#
# Skip the slow tests above a threshold (ms):
#   ./test-all.sh --slowTestThreshold=300
#
# You can mix and match any Vitest CLI flag with the file/name filters above.
# See `bunx vitest --help` for the full list.
#
set -euo pipefail
bun run test --run "$@"
