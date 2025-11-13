#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/deannewton/Projects/QLC/Quicklist-Claude"
PORT_TO_FREE=${PORT_TO_FREE:-4577}

cd "$ROOT_DIR"

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti ":${PORT_TO_FREE}" || true)
  if [[ -n "${PIDS}" ]]; then
    echo "Killing processes on port ${PORT_TO_FREE}: ${PIDS}"
    kill ${PIDS} || true
  fi
else
  echo "lsof not found; skipping port cleanup."
fi

exec nodemon server.js
