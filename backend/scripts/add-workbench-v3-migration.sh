#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
MIGRATIONS='src/Pakpost.Infrastructure/Persistence/Migrations'
if ! find "$MIGRATIONS" -name '*.cs' -print -quit 2>/dev/null | grep -q .; then
  echo 'No existing migration found. Verify you are using the working backend and InitialCreate is already recorded.' >&2
  exit 1
fi
dotnet tool restore
dotnet build Pakpost.slnx
DOTNET_ARGS=(--project src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj --startup-project src/Pakpost.Api/Pakpost.Api.csproj --context PakpostDbContext)
dotnet ef migrations add WorkbenchV3 "${DOTNET_ARGS[@]}" --output-dir Persistence/Migrations
mkdir -p artifacts
dotnet ef migrations script --idempotent "${DOTNET_ARGS[@]}" --output artifacts/workbench-v3-idempotent.sql
printf '%s\n' 'Migration generated. Review the new Up() and artifacts/workbench-v3-idempotent.sql before applying.'
printf '%s\n' 'DO NOT re-run init.sh or delete old migrations.'
