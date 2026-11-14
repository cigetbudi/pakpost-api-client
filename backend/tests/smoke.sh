#!/usr/bin/env bash
# Requires the backend running. Does not mutate DB.
set -euo pipefail
API="${API_URL:-http://127.0.0.1:5080}"
echo '1. Health:'
curl --fail-with-body -sS "$API/health"
printf '\n2. Anonymous workspace access (expect 401): '
status=$(curl -sS -o /dev/null -w '%{http_code}' "$API/api/workspaces")
echo "$status"
[[ "$status" == '401' ]] || { echo 'ERROR: private endpoint was not protected' >&2;exit 1; }
echo '3. Anonymous public proxy (may require internet connectivity):'
curl --fail-with-body -sS -H 'Content-Type: application/json' \
  -d '{"method":"GET","url":"https://httpbin.org/get","headers":{},"body":""}' \
  "$API/api/proxy/send"
echo
