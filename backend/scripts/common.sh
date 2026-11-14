#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/.env" ]] || { echo 'Copy .env.example to .env and edit settings' >&2; exit 1; }
set -a
# .env must be a trusted shell-compatible file (KEY='value').
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a
[[ -n "${ConnectionStrings__Postgres:-}" && "$ConnectionStrings__Postgres" != *REPLACE_ME* && "$ConnectionStrings__Postgres" != *ep-EXAMPLE* ]] || {
  echo 'Set ConnectionStrings__Postgres to a NEW Neon database/branch' >&2; exit 1;
}
command -v dotnet >/dev/null || { echo '.NET SDK 10 required' >&2; exit 1; }
cd "$ROOT"
