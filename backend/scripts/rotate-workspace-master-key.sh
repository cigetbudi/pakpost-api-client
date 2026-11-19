#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/.env" ]] || { echo 'backend/.env not found' >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

if [[ "$#" -ne 3 || ( "$1" != '--dry-run' && "$1" != '--execute' ) || "$2" != '--expect-database' ]]; then
  echo "Usage: $0 --dry-run|--execute --expect-database DATABASE_NAME" >&2
  exit 2
fi

exec dotnet run --project "$ROOT/tools/Pakpost.KeyRotation/Pakpost.KeyRotation.csproj" -- "$@"
