#!/usr/bin/env bash
set -Eeuo pipefail
url="${PAKPOST_D5_URL:-https://pakpost.duckdns.org}"
[[ $url == https://* ]] || { echo 'Require https'; exit 1; }
for endpoint in /health/ready /desktop-connect; do
 code=$(curl -sS -L -o /dev/null -w '%{http_code}' --connect-timeout 4 --max-time 15 "$url$endpoint" || true)
 echo "$endpoint -> $code"
 [[ $code == 200 ]] || exit 1
done
code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 4 --max-time 15 -X POST "$url/api/desktop-auth/start" || true)
echo "/api/desktop-auth/start -> $code (200=enabled, 404=disabled)"
[[ $code == 200 || $code == 404 ]] || exit 1
