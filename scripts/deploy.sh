#!/bin/bash
# Deploy s pojistkou: typecheck + testy musí projít, jinak se nebuildí ani nerestartuje.
# Použití: ./scripts/deploy.sh   (jako root; build a PM2 běží pod uživatelem nanto)
#
# Web i worker jedou pod neprivilegovaným uživatelem `nanto` (SEC-33). Root zde
# jen srovná vlastnictví (editace zdrojáků rootem je OK) a deleguje build +
# restart na nanto — jinak by .next patřil rootovi a aplikace by ho nemohla číst/psát.
set -euo pipefail
cd "$(dirname "$0")/.."
APP_USER=nanto

echo "==> Typecheck"
npx tsc --noEmit

echo "==> Testy (nanto_crm_test)"
npm test

if [ "$(id -u)" = "0" ] && id "$APP_USER" >/dev/null 2>&1; then
  echo "==> Vlastnictví → $APP_USER"
  chown -R "$APP_USER:$APP_USER" .
  chmod 600 .env
  RUN_AS="sudo -u $APP_USER -H"
else
  RUN_AS=""
fi

echo "==> Build"
$RUN_AS bash -c "cd '$PWD' && npm run build"

echo "==> Restart PM2 (web + worker)"
$RUN_AS bash -c "cd '$PWD' && pm2 startOrRestart ecosystem.config.js --update-env"

sleep 5
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
if [ "$CODE" != "200" ]; then
  echo "!! Aplikace po restartu vrací HTTP $CODE — zkontroluj: $RUN_AS pm2 logs nanto-crm"
  exit 1
fi
if ! $RUN_AS pm2 describe nanto-crm-worker | grep -q "online"; then
  echo "!! Worker neběží — zkontroluj: $RUN_AS pm2 logs nanto-crm-worker"
  exit 1
fi
echo "==> OK, aplikace běží (HTTP 200) + worker online"
