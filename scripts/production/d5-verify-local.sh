#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
command -v dotnet >/dev/null || { echo 'Missing dotnet'; exit 1; }
command -v bun >/dev/null || { echo 'Missing bun'; exit 1; }
command -v cargo >/dev/null || { echo 'Missing cargo (source ~/.cargo/env)'; exit 1; }
printf '\n[D5] Backend build\n'
dotnet build backend/src/Pakpost.Api/Pakpost.Api.csproj
printf '\n[D5] Frontend build\n'
(cd frontend && bun run build)
printf '\n[D5] Rust check\n'
cargo check --manifest-path desktop/src-tauri/Cargo.toml
printf '\n[D5] Existing security checks\n'
dotnet test backend/tests/Pakpost.SecurityChecks/Pakpost.SecurityChecks.csproj --no-restore
printf '\n[OK] Local builds and security checks passed. PostgreSQL integration tests require the existing disposable DB setup.\n'
