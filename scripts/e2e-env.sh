#!/usr/bin/env bash
# Sdílené jádro izolovaného prostředí pro e2e.sh a marketing-shots.sh.
#
# NIKDY nesahá na prod: buildí do vlastní kopie pracovního stromu
# (E2E_ENV_DIR) a běží proti DB nanto_crm_test. Prod .next ani nanto_crm
# se nedotkne. Bere aktuální pracovní strom (i necommitnuté změny).
#
# Použití (source):  . scripts/e2e-env.sh; e2e_env_build; …; e2e_env_start
# Nastaví: ROOT, ENVDIR, PORT, TEST_DB_URL, PROD_DB_URL

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVDIR="${E2E_ENV_DIR:-/var/tmp/felucia-e2e}"
PORT="${E2E_PORT:-3001}"

# Sync + schéma test DB + izolovaný build
e2e_env_build() {
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
  PROD_DB_URL="$(grep '^DATABASE_URL' "$ROOT/.env" | cut -d'"' -f2)"
  (cd "$ENVDIR" && npx prisma db push --accept-data-loss --url "$TEST_DB_URL" >/dev/null)
  psql "$TEST_DB_URL" -q -f "$ENVDIR/prisma/rls.sql" 2>/dev/null
  psql "$TEST_DB_URL" -q -f "$ENVDIR/prisma/webhook-triggers.sql" 2>/dev/null

  echo "==> Build (izolovaný, s cache)"
  (cd "$ENVDIR" && npm run build > /tmp/e2e-build.log 2>&1) \
    || { echo "BUILD SELHAL — viz /tmp/e2e-build.log"; tail -30 /tmp/e2e-build.log; exit 1; }
}

# Start `next start` na $PORT; server se zabije při ukončení volajícího skriptu
e2e_env_start() {
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
}
