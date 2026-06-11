#!/bin/bash
# Deploy s pojistkou: typecheck + testy musí projít, jinak se nebuildí ani nerestartuje.
# Použití: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Typecheck"
npx tsc --noEmit

echo "==> Testy (nanto_crm_test)"
npm test

echo "==> Build"
npm run build

echo "==> Restart PM2"
pm2 restart nanto-crm --update-env

sleep 5
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
if [ "$CODE" != "200" ]; then
  echo "!! Aplikace po restartu vrací HTTP $CODE — zkontroluj pm2 logs nanto-crm"
  exit 1
fi
echo "==> OK, aplikace běží (HTTP 200)"
