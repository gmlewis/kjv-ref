#!/usr/bin/env bash
# scripts/e2e-login.sh — capture session for Playwright e2e tests
#
# Primary method: reads cookies directly from your Chrome profile (macOS only).
# Fallback:       opens a headed browser for manual sign-in.
#
# Usage:
#   ./scripts/e2e-login.sh          # auto (Chrome cookie extraction)
#   ./scripts/e2e-login.sh --manual # headed browser fallback
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

MANUAL="${1:-}"

echo ""
echo "─────────────────────────────────────────────────────────"
echo "  KJV Memorize — e2e auth setup"
echo "─────────────────────────────────────────────────────────"

if [[ "$MANUAL" == "--manual" ]]; then
  echo ""
  echo "  Manual mode: a browser window will open."
  echo "  → Click \"Continue with Google\" and complete sign-in."
  echo "  → The window closes automatically when done."
  echo ""
  bun run e2e/global-setup.ts
else
  echo ""
  echo "  Extracting session from your Chrome profile..."
  echo "  (Make sure you are already logged in on preview.prophet.do)"
  echo ""
  bun run scripts/grab-session.ts
fi

echo "─────────────────────────────────────────────────────────"
echo ""
