#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${QUICKLIST_BASE_URL:-https://quicklist.it.com}"
TOKEN="${QUICKLIST_BEARER_TOKEN:-}"

TMP_DIR="/tmp/quicklist-smoke"
mkdir -p "$TMP_DIR"

say() { printf '%s\n' "$*"; }

say "== Quicklist Smoke Test =="
say "Base URL: $BASE_URL"

# 1) Health check
HEALTH_OUT="$TMP_DIR/health.json"
HEALTH_CODE=$(curl -s -o "$HEALTH_OUT" -w "%{http_code}" "$BASE_URL/api/health" || true)
say "Health: HTTP $HEALTH_CODE"
if [ -s "$HEALTH_OUT" ]; then
  head -c 400 "$HEALTH_OUT"; echo
fi

# 2) Analysis endpoint (requires auth)
if [ -z "$TOKEN" ]; then
  say "ERROR: QUICKLIST_BEARER_TOKEN is required for /api/analyze-image-quality"
  exit 1
fi

# 1x1 transparent PNG
IMG_DATA="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
ANALYZE_OUT="$TMP_DIR/analyze.json"
ANALYZE_CODE=$(curl -s -o "$ANALYZE_OUT" -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$IMG_DATA\"}" \
  "$BASE_URL/api/analyze-image-quality" || true)

say "Analyze-image-quality: HTTP $ANALYZE_CODE"
if [ -s "$ANALYZE_OUT" ]; then
  head -c 800 "$ANALYZE_OUT"; echo
fi

say "Smoke test complete."
