#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="$ROOT_DIR/public"

mkdir -p "$PUBLIC_DIR"

# Sync static assets into public for dev parity with Vercel
cp -f "$ROOT_DIR/index.html" "$PUBLIC_DIR/index.html"
for file in manifest.json service-worker.js pwa-features.js offline.html; do
  if [ -f "$ROOT_DIR/$file" ]; then
    cp -f "$ROOT_DIR/$file" "$PUBLIC_DIR/"
  fi
done

for dir in icons json_anim brand; do
  if [ -d "$ROOT_DIR/$dir" ]; then
    cp -R "$ROOT_DIR/$dir" "$PUBLIC_DIR/" 2>/dev/null || true
  fi
done

if command -v nodemon >/dev/null 2>&1; then
  nodemon "$ROOT_DIR/server.js"
else
  node "$ROOT_DIR/server.js"
fi
