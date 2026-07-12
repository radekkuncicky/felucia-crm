#!/usr/bin/env bash
set -euo pipefail

# E2E testy v izolovaném prostředí.
#
# NIKDY nesahá na prod: buildí do vlastní kopie pracovního stromu
# (E2E_ENV_DIR) a běží proti DB nanto_crm_test. Prod .next ani nanto_crm
# se nedotkne. Testuje aktuální pracovní strom (i necommitnuté změny).
#
# Použití: ./scripts/e2e.sh [playwright args…]

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENVDIR="${E2E_ENV_DIR:-/var/tmp/felucia-e2e}"
PORT="${E2E_PORT:-3001}"

echo "==> Sync pracovního stromu do $ENVDIR"
mkdir -p "$ENVDIR"
rsync -a --delete \
  --exclude .git --exclude node_modules --exclude .next \
  --exclude e2e/.results --exclude e2e/.auth --exclude public/uploads \
  "$ROOT/" "$ENVDIR/"
ln -sfn "$ROOT/node_modules" "$ENVDIR/node_modules"

# Test .env: prod credentials, ale DB nanto_crm_test a localhost URL
sed -e 's#/nanto_crm"#/nanto_crm_test"#' \
    -e "s#^NEXTAUTH_URL=.*#NEXTAUTH_URL=\"http://localhost:$PORT\"#" \
    "$ROOT/.env" > "$ENVDIR/.env"
grep -q nanto_crm_test "$ENVDIR/.env" || { echo "CHYBA: test DB URL se nepodařilo odvodit"; exit 1; }

echo "==> Schéma test DB (prisma db push + RLS)"
TEST_DB_URL="$(grep '^DATABASE_URL' "$ENVDIR/.env" | cut -d'"' -f2)"
(cd "$ENVDIR" && npx prisma db push --accept-data-loss --url "$TEST_DB_URL" >/dev/null)
psql "$TEST_DB_URL" -q -f "$ENVDIR/prisma/rls.sql" 2>/dev/null
psql "$TEST_DB_URL" -q -f "$ENVDIR/prisma/webhook-triggers.sql" 2>/dev/null

echo "==> Build (izolovaný, s cache)"
(cd "$ENVDIR" && npm run build > /tmp/e2e-build.log 2>&1) \
  || { echo "BUILD SELHAL — viz /tmp/e2e-build.log"; tail -30 /tmp/e2e-build.log; exit 1; }

echo "==> Seed test DB"
(cd "$ENVDIR" && npx tsx e2e/seed.ts)

echo "==> Start serveru na :$PORT"
fuser -k "$PORT/tcp" 2>/dev/null || true
(cd "$ENVDIR" && ./node_modules/.bin/next start -p "$PORT" > /tmp/e2e-server.log 2>&1 &
 echo $! > "$ENVDIR/.server.pid")
trap 'kill "$(cat "$ENVDIR/.server.pid" 2>/dev/null)" 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  curl -sf -o /dev/null "http://localhost:$PORT/auth/signin" && break
  [ "$i" = 30 ] && { echo "Server nenastartoval — viz /tmp/e2e-server.log"; exit 1; }
  sleep 1
done

echo "==> Playwright"
cd "$ROOT"
mkdir -p e2e/.auth
E2E_BASE_URL="http://localhost:$PORT" npx playwright test "$@"
