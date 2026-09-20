#!/usr/bin/env bash
# Nainstaluje catch-all server bloky (SEC-14) a bezpečně reloadne nginx.
set -euo pipefail
SRC="$(dirname "$0")/nginx-default-catchall.conf"
DST=/etc/nginx/conf.d/00-default-catchall.conf
cp "$SRC" "$DST"
if ! nginx -t; then
  echo "!! nginx -t selhal — odstraňuji $DST"; rm -f "$DST"; nginx -t; exit 1
fi
systemctl reload nginx
echo "==> nginx reloadnut"
sleep 1
echo -n "neznámý Host na 443 (očekáváno 000 = spojení zavřeno): "; curl -sk -o /dev/null -w '%{http_code}\n' --resolve foo.example:443:127.0.0.1 https://foo.example/ || true
echo -n "neznámý Host na 80  (očekáváno 000): "; curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: foo.example' http://127.0.0.1/ || true
echo -n "felucia.io → "; curl -sk -o /dev/null -w '%{http_code}\n' --resolve felucia.io:443:127.0.0.1 https://felucia.io/
echo -n "cert pro neznámý Host: "; echo | openssl s_client -connect 127.0.0.1:443 -servername foo.example 2>/dev/null | openssl x509 -noout -subject -enddate | tr '\n' ' '; echo
