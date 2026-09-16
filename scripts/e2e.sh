#!/usr/bin/env bash
set -euo pipefail

# E2E testy v izolovaném prostředí (viz scripts/e2e-env.sh — nikdy prod).
#
# Použití: ./scripts/e2e.sh [playwright args…]

. "$(dirname "$0")/e2e-env.sh"

e2e_env_build

echo "==> Seed test DB"
(cd "$ENVDIR" && npx tsx e2e/seed.ts)

e2e_env_start

echo "==> Playwright"
cd "$ROOT"
mkdir -p e2e/.auth
E2E_BASE_URL="http://localhost:$PORT" npx playwright test "$@"
