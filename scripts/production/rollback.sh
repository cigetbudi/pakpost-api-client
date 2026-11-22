#!/usr/bin/env bash
# App-image rollback only. Does not and must not downgrade a migrated DB.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
test -f .pakpost-last-backup || { echo 'No app image backup reference'; exit 1; }
readarray -t saved < .pakpost-last-backup
backup="${saved[0]:-}"
[[ "${saved[1]:-0}" == 1 && "$backup" == pakpost-previous-* ]] || { echo 'No previous app images available'; exit 1; }
docker image inspect "pakpost/backend:${backup}" >/dev/null
docker image inspect "pakpost/frontend:${backup}" >/dev/null
printf 'Rollback application images to %s? Database schema will NOT be rolled back. [y/N] ' "$backup"
read -r answer
[[ "$answer" == y || "$answer" == Y ]] || exit 1
docker tag "pakpost/backend:${backup}" pakpost/backend:local
docker tag "pakpost/frontend:${backup}" pakpost/frontend:local
docker compose up -d --no-build --force-recreate backend frontend caddy
docker compose ps
echo 'Verify login, API, SignalR, and schema compatibility after rollback.'
