#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
: "${Jwt__SigningKey:?Jwt__SigningKey missing}"
dotnet run --project src/Pakpost.Api/Pakpost.Api.csproj --no-launch-profile
