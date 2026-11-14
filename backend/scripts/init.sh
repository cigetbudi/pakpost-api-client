#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

if find src/Pakpost.Infrastructure/Persistence/Migrations -name '*.cs' -print -quit 2>/dev/null | grep -q .; then
  echo 'Migration files exist. Review manually instead of regenerating InitialCreate.' >&2
  exit 1
fi

dotnet tool restore
dotnet restore Pakpost.slnx
dotnet build Pakpost.slnx --no-restore

dotnet ef migrations add InitialCreate \
  --project src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj \
  --startup-project src/Pakpost.Api/Pakpost.Api.csproj \
  --context PakpostDbContext \
  --output-dir Persistence/Migrations

mkdir -p artifacts
dotnet ef migrations script 0 \
  --project src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj \
  --startup-project src/Pakpost.Api/Pakpost.Api.csproj \
  --context PakpostDbContext \
  --output artifacts/initial.sql

echo 'Migration generated. REVIEW artifacts/initial.sql BEFORE applying.'
