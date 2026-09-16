#!/usr/bin/env bash
set -euo pipefail

# Desktop snímky CRM pro marketingový web (felucia.io) — reálné obrazovky
# ukázkové organizace, žádné ilustrace. Běží v izolovaném prostředí
# (scripts/e2e-env.sh, DB nanto_crm_test), prod se nedotkne; produkty pro
# seed čte read-only z prod knihovny NANTO (SEED_SOURCE_DATABASE_URL).
#
# Výstup: public/marketing/crm-*.jpg (viz e2e/marketing-shots.ts).
# Po změně UI stačí pustit znovu a snímky commitnout.
#
# Použití: ./scripts/marketing-shots.sh [jen-tyto-snimky…]

. "$(dirname "$0")/e2e-env.sh"

e2e_env_build

echo "==> Seed ukázkové organizace do test DB"
(cd "$ENVDIR" && SEED_SOURCE_DATABASE_URL="$PROD_DB_URL" npx tsx scripts/seed-ukazka.ts)

e2e_env_start

echo "==> Snímky"
cd "$ROOT"
E2E_DB_URL="$TEST_DB_URL" E2E_BASE_URL="http://localhost:$PORT" npx tsx e2e/marketing-shots.ts "$@"
