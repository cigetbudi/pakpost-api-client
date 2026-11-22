#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
docker compose --profile migration run --rm migration migrations list \
  --project src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj \
  --startup-project src/Pakpost.Api/Pakpost.Api.csproj \
  --context PakpostDbContext
