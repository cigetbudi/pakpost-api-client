#!/usr/bin/env bash
# Recreate backend only. Does not touch .env or database migrations.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
case ${1:-} in
 --enable) value=true; prompt=ENABLE ;;
 --disable) value=false; prompt=DISABLE ;;
 *) echo 'Usage: bash scripts/production/d5-toggle-vps.sh --enable|--disable'; exit 2 ;;
esac
[[ -f .env && -f compose.yaml ]] || { echo 'Run from deployment root'; exit 1; }
printf 'Type %s to change LIVE DesktopAuth to %s: ' "$prompt" "$value"
read -r answer
[[ $answer == "$prompt" ]] || exit 1
# Persistent flag in root .env, without dumping contents.
cp -p .env ".env.before-d5-toggle-$(date -u +%Y%m%dT%H%M%S)"
chmod 600 .env.before-d5-toggle-* 2>/dev/null || true
python3 - "$value" <<'PYIN'
import pathlib,sys
p=pathlib.Path('.env'); value=sys.argv[1]
s=p.read_text(); lines=s.splitlines()
lines=[l for l in lines if not l.startswith('DESKTOP_AUTH_ENABLED=')]
lines.append('DESKTOP_AUTH_ENABLED='+value)
p.write_text('\n'.join(lines)+'\n')
PYIN
docker compose config --quiet
docker compose up -d --no-build --force-recreate backend
url="${PAKPOST_D5_URL:-https://pakpost.duckdns.org}"
if [[ $value == true ]]; then
 status=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 4 --max-time 10 -X POST "$url/api/desktop-auth/start" || true)
 if [[ "$status" != 200 ]]; then
  echo "[FAIL] D5 endpoint returned $status. Disabling again."
  sed -i 's/^DESKTOP_AUTH_ENABLED=true$/DESKTOP_AUTH_ENABLED=false/' .env
  docker compose up -d --no-build --force-recreate backend
  exit 1
 fi
 echo '[OK] Desktop pairing start returned 200. Do not expose response device secret.'
else
 echo '[OK] Desktop authentication disabled. All desktop tokens should be rejected by auth handler.'
fi
