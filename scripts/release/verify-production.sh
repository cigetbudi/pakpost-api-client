#!/usr/bin/env bash
# Read-only smoke checks, no credential or workspace data access.
set -euo pipefail
for url in https://pakpostapi.com/ https://pakpostapi.com/docs/ https://pakpostapi.com/downloads/ https://app.pakpostapi.com/ https://pakpost.duckdns.org/; do
  code=$(curl --connect-timeout 5 --max-time 15 -sS -o /dev/null -w '%{http_code}' "$url")
  [[ "$code" = 200 ]] || { echo "$url unexpected HTTP $code"; exit 1; }
  echo "$url HTTP $code"
done
for origin in https://app.pakpostapi.com https://pakpost.duckdns.org; do
  curl --connect-timeout 5 --max-time 15 -fsS "$origin/health/ready" | python3 -c 'import json,sys; assert json.load(sys.stdin)["status"] == "healthy"'
  echo "$origin ready"
done
redirect=$(curl --connect-timeout 5 --max-time 15 -sS -o /dev/null -w '%{http_code} %{redirect_url}' https://www.pakpostapi.com/)
[[ "$redirect" == '301 https://pakpostapi.com/' ]] || { echo "Unexpected www redirect: $redirect"; exit 1; }
curl --connect-timeout 5 --max-time 15 -fsS https://pakpostapi.com/ | python3 -c 'import sys; assert "https://app.pakpostapi.com/" in sys.stdin.read()'
echo 'Read-only domain checks passed. SSO, invitation, realtime and extensions need separate real-client tests.'
