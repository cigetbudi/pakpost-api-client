#!/usr/bin/env bash
# Restore a TRUSTED custom-format dump into an isolated, disposable container.
# Never connect to the configured PakPost database, never mount data/secrets.
set -euo pipefail
if [[ $# -ne 2 || ! -f "$1" ]]; then
  echo 'Usage: verify-postgres-backup.sh /path/to/trusted.dump postgres:<matching-major>' >&2
  exit 2
fi
backup="$1"; image="$2"
[[ "$image" =~ ^postgres:[0-9]+(-[a-zA-Z0-9.]+)?$ ]] || { echo 'Use an official local postgres image matching the source version.' >&2; exit 2; }
command -v docker >/dev/null
container=$(docker run --pull never --detach --network none --label pakpost.backup-verification=true \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=pakpost_verify "$image")
trap 'docker rm -fv "$container" >/dev/null 2>&1 || true' EXIT
for ((i=0;i<60;i++)); do
  if docker exec "$container" pg_isready -U postgres -d pakpost_verify -h 127.0.0.1 >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" pg_isready -U postgres -d pakpost_verify -h 127.0.0.1 >/dev/null
docker exec -i "$container" pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -U postgres -d pakpost_verify < "$backup"
# Structural verification only; no rows or credentials printed.
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d pakpost_verify -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" | grep -Eq '^[1-9][0-9]*$'
echo 'PASS: trusted archive restored into disposable PostgreSQL and contains public tables.'
echo 'Application-level validation, encryption keys, and recovery-point verification remain separate.'
