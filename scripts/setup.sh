#!/usr/bin/env bash
# scripts/setup.sh — one-time setup: install Prophet SDK and regenerate types
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "─────────────────────────────────────────────────────────"
echo "  KJV Memorize — setup"
echo "─────────────────────────────────────────────────────────"

# 1. Install npm dependencies (if not already done)
echo ""
echo "→ Installing npm dependencies..."
bun install

# 2. Install Prophet SDK from the platform
echo ""
echo "→ Installing Prophet SDK from preview.prophet.do..."
curl -sL https://preview.prophet.do/sdk/prophet-sdk.tgz | tar -xz -C node_modules/
echo "  ✓ Prophet SDK installed"

# 3. Regenerate TypeScript types from the schema
echo ""
echo "→ Regenerating TypeScript types from kjv-memorize.prophet..."
prophet typegen kjv-memorize.prophet
echo "  ✓ Types regenerated"

echo ""
echo "─────────────────────────────────────────────────────────"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "    • Deploy:     ./scripts/deploy.sh \"initial deploy\""
echo "    • E2e login:  ./scripts/e2e-login.sh"
echo "    • E2e tests:  bun run e2e"
echo "─────────────────────────────────────────────────────────"
echo ""
