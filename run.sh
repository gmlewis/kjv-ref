#!/usr/bin/env bash
set -euo pipefail

# Ensure dependencies are installed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  bun install
fi

# Start the Vite dev server in the background
echo "Starting Vite dev server..."
bun run dev &
DEV_PID=$!

# Wait for the server to be ready, then open Chrome.
#
# `server.strictPort` is set in vite.config.ts, so if port 3000 is already taken
# the dev server *exits* rather than quietly moving to 3001. That makes the two
# failure modes below worth distinguishing, because a bare `curl $URL` cannot:
# a stale server from an earlier session — or an unrelated project — answers on
# 3000 just as happily, and `open` would then show you the wrong app.
#
# Note the app path, not the bare root: with `base: '/kjv-ref/'` the root answers
# 302 with an *empty* body, which `curl --fail` happily accepts. Asking for the
# real path is both the only way to see the HTML and where Chrome should land.
URL="http://localhost:3000/kjv-ref/"
echo "Waiting for dev server at $URL..."
ready=0
for i in $(seq 1 30); do
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    echo "Dev server exited before it was ready — port 3000 is probably already in use." >&2
    echo "Find what is holding it with:" >&2
    echo "    lsof -nP -iTCP:3000 -sTCP:LISTEN" >&2
    wait "$DEV_PID" 2>/dev/null || true
    exit 1
  fi
  # Captured to a variable rather than piped into `grep -q`: under `set -o
  # pipefail` a grep that exits on its first match can SIGPIPE curl and fail the
  # whole pipeline, which reads as "not ready yet".
  #
  # `src/main.tsx` is served only by *this* app's dev server, so the check cannot
  # be satisfied by a stale instance or by another project on the same port.
  body="$(curl -s --fail "$URL" 2>/dev/null || true)"
  if [[ "$body" == *'src/main.tsx'* ]]; then
    echo "Server is up — opening Chrome."
    open -a "Google Chrome" "$URL"
    ready=1
    break
  fi
  sleep 0.5
done

if [ "$ready" -eq 0 ]; then
  echo "Timed out after 15s waiting for this app on $URL; leaving the dev server running." >&2
fi

# Bring the dev server to the foreground so Ctrl+C kills it
echo "Press Ctrl+C to stop the dev server."
wait $DEV_PID
