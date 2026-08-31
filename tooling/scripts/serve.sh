#!/usr/bin/env bash
# Start the Odyssey production server (default port 18790).
#
# Usage: tooling/scripts/serve.sh [port]
#
# Loads apps/web/.env.local first so generation settings reach `next start`
# exactly as `next dev` would apply them, builds once if no bundle exists,
# and serves on the given port with matching ODYSSEY_APP_ORIGIN.
set -euo pipefail

PORT="${1:-18790}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB="$ROOT/apps/web"

# Developer-local config (gitignored) — generation vars, fixtures.
if [ -f "$WEB/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$WEB/.env.local"
  set +a
fi

export ODYSSEY_APP_ORIGIN="http://localhost:${PORT}"

if [ ! -f "$WEB/.next/BUILD_ID" ]; then
  echo "→ no production bundle found; building…"
  (cd "$ROOT" && pnpm build)
fi

echo "→ Odyssey on http://localhost:${PORT}"
cd "$WEB"
exec pnpm exec next start --port "$PORT"
