#!/usr/bin/env bash
# Jednorázová migrace: web + worker (PM2) z roota pod neprivilegovaného uživatele
# `nanto` (SEC-33, docs/SECURITY_AUDIT_2026-09.md). Idempotentní v rozumné míře.
# Spouštět jako root. Výpadek ~10–20 s (kill root PM2 → start pod nanto).
set -euo pipefail
APP=/var/www/nanto-crm
USER_NAME=nanto
HOME_DIR=/home/$USER_NAME
log() { echo "==> $*"; }

# 1) uživatel
if ! id "$USER_NAME" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$HOME_DIR" --shell /usr/sbin/nologin "$USER_NAME"
  log "uživatel $USER_NAME založen"
fi
mkdir -p "$HOME_DIR/.cache"
# Chromium pro puppeteer — kopie z roota (postinstall ho stahuje do ~/.cache/puppeteer)
if [ -d /root/.cache/puppeteer ] && [ ! -d "$HOME_DIR/.cache/puppeteer" ]; then
  cp -a /root/.cache/puppeteer "$HOME_DIR/.cache/puppeteer"
fi
chown -R "$USER_NAME:$USER_NAME" "$HOME_DIR"

# 2) vlastnictví aplikace a logů (root může dál číst i editovat)
chown -R "$USER_NAME:$USER_NAME" "$APP"
chmod 600 "$APP/.env"
mkdir -p /var/log/pm2 && chown -R "$USER_NAME:$USER_NAME" /var/log/pm2
git config --global --add safe.directory "$APP" >/dev/null 2>&1 || true
log "vlastnictví předáno $USER_NAME"

# 3) build pod nanto (z aktuálního pracovního stromu)
log "build pod $USER_NAME"
sudo -u "$USER_NAME" -H bash -c "cd $APP && npm run build" > /tmp/migrate-build.log 2>&1 \
  || { echo "!! build selhal — viz /tmp/migrate-build.log"; tail -20 /tmp/migrate-build.log; exit 1; }

# 4) jednorázový hash existujících auth tokenů (vlna 3) — těsně před startem nového kódu
if [ -f "$APP/scripts/hash-existing-auth-tokens.sql" ] && [ ! -f "$APP/.hash-tokens-done" ]; then
  psql "$(grep -E '^DATABASE_URL=' "$APP/.env" | cut -d'"' -f2)" -q -f "$APP/scripts/hash-existing-auth-tokens.sql"
  touch "$APP/.hash-tokens-done"; chown "$USER_NAME:$USER_NAME" "$APP/.hash-tokens-done"
  log "auth tokeny zahashovány (jednorázově)"
fi

# 5) přepnutí PM2: root daemon pryč, nanto daemon start
if pm2 ping >/dev/null 2>&1; then
  pm2 delete all >/dev/null 2>&1 || true
  pm2 kill >/dev/null 2>&1 || true
  pm2 unstartup systemd >/dev/null 2>&1 || true
  log "root PM2 zastaven"
fi
sudo -u "$USER_NAME" -H bash -c "cd $APP && pm2 startOrRestart ecosystem.config.js --update-env" >/dev/null
sudo -u "$USER_NAME" -H bash -c "pm2 install pm2-logrotate >/dev/null 2>&1; pm2 set pm2-logrotate:max_size 10M >/dev/null; pm2 set pm2-logrotate:retain 14 >/dev/null; pm2 set pm2-logrotate:compress true >/dev/null; pm2 save >/dev/null"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER_NAME" --hp "$HOME_DIR" >/dev/null
systemctl enable "pm2-$USER_NAME" >/dev/null 2>&1 || true
log "PM2 běží pod $USER_NAME, autostart pm2-$USER_NAME"

# 6) ověření
sleep 6
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)
echo "HTTP: $CODE"
sudo -u "$USER_NAME" -H pm2 ls | grep -E "nanto-crm" | awk -F'│' '{print $3 $10 $12}'
ps -eo user,cmd | grep -E "next-server|tsx worker" | grep -v grep | awk '{print $1, $2, $3}'
[ "$CODE" = "200" ] || { echo "!! aplikace nevrací 200 — pm2 logs pod nanto: sudo -u nanto pm2 logs"; exit 1; }
echo "==> OK"
