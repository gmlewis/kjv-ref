#!/usr/bin/env bash
set -e

echo "Building latest code..."
bun run build

echo "Launching Pixel 10XL simulator..."
bun run scripts/simulate-mobile.ts
