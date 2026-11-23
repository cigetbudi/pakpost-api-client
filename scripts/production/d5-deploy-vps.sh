#!/usr/bin/env bash
# Run only on the PakPost VPS, from /opt/pakpost. Database migrations are NOT run.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
if [[ ! -f .env ]]; then echo 'Missing root .env'; exit 1; fi
if [[ ! -f docker/backend.Dockerfile || ! -f docker/frontend.Dockerfile ]]; then
 echo 'Dockerfiles missing: restore from current production repository before deploying'; exit 1
fi
if [[ ! -f backend/src/Pakpost.Api/Controllers/DesktopAuthController.cs ]]; then echo 'Desktop auth controller missing'; exit 1; fi
if ! grep -q 'DesktopAuth__Enabled:' compose.yaml; then echo 'D5 Compose flag missing'; exit 1; fi
if [[ ${1:-} != --deploy ]]; then
 cat <<'MSG'
DRY RUN ONLY: no services changed.
This deploy changes live web/backend containers; do NOT run until:
 - code reviewed and tested locally, production .env backed up, restore plan ready
 - Google web login and existing workspace API baseline verified
 - source copied via a reviewed release bundle (NEVER overwrite VPS .env)
To deploy with DesktopAuth OFF: bash scripts/production/d5-deploy-vps.sh --deploy
To enable after smoke test: bash scripts/production/d5-toggle-vps.sh --enable
To disable immediately: bash scripts/production/d5-toggle-vps.sh --disable
MSG
 exit 0
fi
printf 'Deploy D5 to LIVE PakPost with DesktopAuth OFF? Type DEPLOY: '
read -r consent
[[ $consent == DEPLOY ]] || { echo 'Cancelled'; exit 1; }
# Persist OFF so future Compose recreations cannot unexpectedly re-enable D5.
cp -p .env ".env.before-d5-deploy-$(date -u +%Y%m%dT%H%M%S)"
python3 - <<'PYIN'
from pathlib import Path
p=Path('.env')
lines=[line for line in p.read_text().splitlines() if not line.startswith('DESKTOP_AUTH_ENABLED=')]
lines.append('DESKTOP_AUTH_ENABLED=false')
p.write_text('\n'.join(lines)+'\n')
PYIN
export DESKTOP_AUTH_ENABLED=false
./scripts/production/deploy.sh
printf '\n[OK] Deployed with desktop auth OFF. Verify web Google login and workspace CRUD before --enable.\n'
