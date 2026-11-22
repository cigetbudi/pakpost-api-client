#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
command -v docker >/dev/null || { echo 'Docker missing'; exit 1; }
command -v curl >/dev/null || { echo 'curl missing'; exit 1; }
test -f .env || { echo 'Missing .env'; exit 1; }
docker info >/dev/null || { echo 'No Docker daemon access'; exit 1; }
docker compose config --quiet
echo '[OK] Docker Compose syntax and daemon'
for key in POSTGRES_CONNECTION_STRING JWT_SIGNING_KEY WORKSPACE_MASTER_KEY ENVIRONMENT_ENCRYPTION_KEY GOOGLE_CLIENT_ID PAKPOST_PUBLIC_URL; do
  if ! grep -q "^${key}=" .env; then echo "Missing .env key: ${key}"; exit 1; fi
done
echo '[OK] Required key names found (values not printed)'
echo 'Verify DNS, Neon target, Google OAuth, and backup/restore point separately.'
