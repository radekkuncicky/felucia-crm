#!/usr/bin/env bash
# Rotace hesla DB role `nanto` (SEC-12, docs/SECURITY_AUDIT_2026-09.md).
# Postup: záloha .env → nové heslo do .env → ALTER ROLE → restart PM2 → ověření.
# Heslo se nikde nevypisuje. Záloha .env zůstane v /root/.env.bak.<čas> (600).
set -euo pipefail
cd "$(dirname "$0")/.."

TS=$(date +%Y%m%d-%H%M%S)
cp -p .env "/root/.env.bak.$TS" && chmod 600 "/root/.env.bak.$TS"
echo "==> Záloha .env: /root/.env.bak.$TS"

OLDURL=$(grep '^DATABASE_URL=' .env | head -1 | cut -d'"' -f2)
NEW=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
NEWURL=$(printf '%s' "$OLDURL" | sed -E "s#(://[^:]+:)[^@]+@#\1${NEW}@#")
[ "$NEWURL" != "$OLDURL" ] || { echo "CHYBA: URL se nepodařilo přepsat"; exit 1; }

# 1) nejdřív .env — každý další start už jede s novým heslem
python3 - "$NEWURL" <<'EOF'
import sys, re
new = sys.argv[1]
p = '.env'
s = open(p).read()
s2 = re.sub(r'^DATABASE_URL="[^"]+"', 'DATABASE_URL="' + new + '"', s, count=1, flags=re.M)
assert s2 != s, 'DATABASE_URL nenalezena'
open(p, 'w').write(s2)
EOF
chmod 600 .env
echo "==> .env přepsán"

# 2) změna hesla v Postgresu (starým spojením)
psql "$OLDURL" -qAtc "ALTER ROLE nanto PASSWORD '$NEW'"
echo "==> ALTER ROLE hotovo"

# 3) restart web + worker s novým prostředím
pm2 startOrRestart ecosystem.config.js --update-env > /dev/null
sleep 5

# 4) ověření
echo "psql novým heslem:  $(psql "$NEWURL" -qAtc 'select current_user')"
echo "psql starým heslem: $(psql "$OLDURL" -qAtc 'select 1' 2>&1 | grep -oE 'password authentication failed|^1$' || echo '?')"
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)
echo "HTTP: $CODE"
pm2 describe nanto-crm-worker | grep -q online && echo "worker: online" || echo "!! worker neběží"
[ "$CODE" = "200" ] || { echo "!! Aplikace nevrací 200 — zkontroluj pm2 logs nanto-crm; rollback: cp /root/.env.bak.$TS .env && ALTER ROLE zpět ze zálohy"; exit 1; }
echo "==> OK, heslo rotováno"
