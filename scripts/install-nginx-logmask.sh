#!/usr/bin/env bash
# Nainstaluje maskovaný log_format (SEC-49) a přepne access_log nanto-crm na něj.
set -euo pipefail
SRC="$(dirname "$0")/nginx-log-masked.conf"
DST=/etc/nginx/conf.d/01-log-masked.conf
SITE=/etc/nginx/sites-available/nanto-crm
cp "$SRC" "$DST"
cp -p "$SITE" "$SITE.bak.$(date +%Y%m%d-%H%M%S)"
sed -i 's#^\(\s*access_log /var/log/nginx/nanto-crm-access.log\);#\1 masked;#' "$SITE"
if ! nginx -t; then
  echo "!! nginx -t selhal — vracím zpět"; rm -f "$DST"; cp -p "$(ls -t $SITE.bak.* | head -1)" "$SITE"; nginx -t; exit 1
fi
systemctl reload nginx
echo "==> nginx reloadnut; access_log:"; grep -n "access_log" "$SITE" | grep -v "^\s*#"
