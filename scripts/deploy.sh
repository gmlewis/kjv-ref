#!/usr/bin/env bash
# scripts/deploy.sh — build, deploy, and promote the app in one step
#
# Usage:
#   ./scripts/deploy.sh "your commit message"
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

MESSAGE="${1:-}"
if [[ -z "$MESSAGE" ]]; then
  echo "Usage: $0 \"deploy message\""
  exit 1
fi

echo ""
echo "─────────────────────────────────────────────────────────"
echo "  KJV Memorize — build & deploy"
echo "─────────────────────────────────────────────────────────"

# 1. Build
echo ""
echo "→ Building..."
bun run build
echo "  ✓ Build complete"

# 2. Strip large data files that live in Prophet file storage (not bundled with the app)
echo ""
echo "→ Stripping large data files from dist/ (served via Prophet file storage)..."
rm -rf dist/interlinear dist/strongs dist/kjv.txt
echo "  ✓ Stripped"

# 3. Deploy (captures output to extract revision number)
echo ""
echo "→ Deploying to Prophet..."
DEPLOY_OUTPUT=$(prophet deploy kjv-memorize.prophet \
  --app kjv-memorize \
  --assets ./dist \
  -m "$MESSAGE" 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract revision number from deploy output (e.g. "revision 14" or "Revision: 14")
REVISION=$(echo "$DEPLOY_OUTPUT" | grep -oE '[Rr]evision[: ]+([0-9]+)' | grep -oE '[0-9]+' | tail -1)

if [[ -z "$REVISION" ]]; then
  echo ""
  echo "  ⚠ Could not detect revision number from deploy output."
  echo "  Run manually: prophet promote kjv-memorize <revision>"
  exit 1
fi

# 4. Promote
echo ""
echo "→ Promoting revision $REVISION..."
prophet promote kjv-memorize "$REVISION"
echo "  ✓ Promoted revision $REVISION"

echo ""
echo "─────────────────────────────────────────────────────────"
echo "  Deploy complete!"
echo "  Live at: https://preview.prophet.do/exp/kjv-memorize"
echo "─────────────────────────────────────────────────────────"
echo ""
