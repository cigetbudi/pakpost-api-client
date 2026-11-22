#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$root"

dotnet build backend/Pakpost.slnx
dotnet test backend/Pakpost.slnx --no-build
dotnet run --project backend/tests/Pakpost.SecurityChecks --no-build

node frontend/scripts/check-source-imports.mjs
node --test frontend/tests/*/*.test.js
