#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
[[ "${1:-}" == "--apply" ]] || { echo 'Usage: ./scripts/apply-migrations.sh --apply (after reviewing SQL)' >&2; exit 2; }
if ! find src/Pakpost.Infrastructure/Persistence/Migrations -name '*.cs' -print -quit 2>/dev/null | grep -q .; then
  echo 'Generate and review InitialCreate using ./scripts/init.sh first' >&2; exit 1
fi

echo 'WARNING: Ensure this points to a NEW Neon DB/branch. No database reset is performed.'
dotnet tool restore
dotnet ef database update \
  --project src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj \
  --startup-project src/Pakpost.Api/Pakpost.Api.csproj \
  --context PakpostDbContext
