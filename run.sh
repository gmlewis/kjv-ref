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

# Wait for the server to be ready, then open Chrome
URL="http://localhost:3000"
echo "Waiting for dev server at $URL..."
for i in $(seq 1 30); do
  if curl -s --output /dev/null --fail "$URL" 2>/dev/null; then
    echo "Server is up — opening Chrome."
    open -a "Google Chrome" "$URL"
    break
  fi
  sleep 0.5
done

# Bring the dev server to the foreground so Ctrl+C kills it
echo "Press Ctrl+C to stop the dev server."
wait $DEV_PID