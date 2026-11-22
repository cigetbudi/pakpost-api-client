#!/usr/bin/env bash
# Deployment: never auto-runs DB migrations; images are backed up for app rollback.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
./scripts/production/preflight.sh
release="$(date -u +%Y%m%dT%H%M%SZ)"
backup="pakpost-previous-${release}"
prev=0
if docker image inspect pakpost/backend:local >/dev/null 2>&1 && docker image inspect pakpost/frontend:local >/dev/null 2>&1; then
  docker tag pakpost/backend:local "pakpost/backend:${backup}"
  docker tag pakpost/frontend:local "pakpost/frontend:${backup}"
  prev=1
  echo "Previous images saved under tag ${backup}"
fi
cat > .pakpost-last-backup.tmp <<EOF
${backup}
${prev}
EOF
chmod 600 .pakpost-last-backup.tmp
mv .pakpost-last-backup.tmp .pakpost-last-backup
printf '\nBuilding next images...\n'
docker compose build --pull backend frontend
printf '\nStarting / recreating services...\n'
docker compose up -d --no-build backend frontend caddy
printf '\nWaiting for backend health and HTTPS...\n'
url="${PAKPOST_HEALTH_URL:-https://pakpost.duckdns.org/health/ready}"
if [[ "$url" != https://* ]]; then echo 'PAKPOST_HEALTH_URL must be HTTPS'; exit 1; fi
ok=0
for attempt in $(seq 1 24); do
  if curl -fsS --connect-timeout 3 --max-time 8 "$url" >/dev/null 2>&1; then ok=1; break; fi
  sleep 5
done
if ((ok)); then
  echo "[OK] Health endpoint passed: ${url}"
  docker compose ps
else
  echo "[FAIL] ${url} did not become healthy. See: docker compose logs --tail=100 backend caddy"
  if ((prev)); then
    echo "Rollback app images: ./scripts/production/rollback.sh"
  fi
  exit 1
fi
