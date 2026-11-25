#!/usr/bin/env bash
# Deployment: never auto-runs DB migrations; images are backed up for app rollback.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
./scripts/production/preflight.sh
# Validate the public endpoint before changing images or containers.
# Read only the two non-secret settings from Compose's interpolation environment.
# Never print the complete environment (it includes production credentials).
public_url="$(docker compose config --environment | sed -n 's/^PAKPOST_PUBLIC_URL=//p')"
site_address="$(docker compose config --environment | sed -n 's/^PAKPOST_SITE_ADDRESS=//p')"
url="${PAKPOST_HEALTH_URL:-${public_url%/}/health/ready}"
if [[ "$url" != https://*/health/ready ]]; then echo 'PAKPOST_HEALTH_URL must be HTTPS and end with /health/ready'; exit 1; fi
origin="${url%/health/ready}"
# Validate candidate Caddy config using the existing image, without exposing ports.
caddy_container="$(docker compose ps -q caddy)"
if [[ -n "$caddy_container" ]]; then
  caddy_image="$(docker inspect --format '{{.Image}}' "$caddy_container")"
else
  caddy_image=caddy:2-alpine
fi
# Avoid inheriting Caddy's fixed bridge IP or binding its production ports.
docker run --rm --network none \
  -e "PAKPOST_SITE_ADDRESS=${site_address:-:80}" -e PAKPOST_ACME_EMAIL=validate@example.invalid \
  -v "$PWD/docker/Caddyfile:/etc/caddy/Caddyfile:ro" \
  "$caddy_image" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
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
# A changed bind-mounted file may retain the old inode in the running container.
# Recreate Caddy only when explicitly applying a new configuration.
if [[ "${PAKPOST_RECREATE_CADDY:-0}" == 1 && -n "$caddy_container" && "$(docker compose ps -q caddy)" == "$caddy_container" ]]; then
  docker compose up -d --no-build --no-deps --force-recreate caddy
fi
printf '\nWaiting for backend health and HTTPS...\n'
ok=0
for attempt in $(seq 1 24); do
  if curl -fsS --connect-timeout 3 --max-time 8 "$origin/health/live" >/dev/null 2>&1 &&
     curl -fsS --connect-timeout 3 --max-time 8 "$url" >/dev/null 2>&1 &&
     curl -fsS --connect-timeout 3 --max-time 8 "$origin/" >/dev/null 2>&1; then
    ok=1; break
  fi
  sleep 5
done
if ((ok)); then
  echo "[OK] Liveness, readiness, and frontend passed: ${url}"
  docker compose ps
else
  echo "[FAIL] ${url} did not become healthy. See: docker compose logs --tail=100 backend caddy"
  if ((prev)); then
    echo "Rollback app images: ./scripts/production/rollback.sh"
  fi
  exit 1
fi
