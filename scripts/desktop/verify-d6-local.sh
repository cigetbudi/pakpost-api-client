#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root/frontend"
bun run test:node
bun run build
cd "$root/desktop/src-tauri"
if ! command -v cargo >/dev/null && [[ -f "$HOME/.cargo/env" ]]; then
  source "$HOME/.cargo/env"
fi
cargo check --locked
cargo test --locked
cd "$root"
dotnet test backend/tests/Pakpost.UnitTests/Pakpost.UnitTests.csproj --filter FullyQualifiedName~DesktopReadinessTests
printf '\n[OK] Local D6 build and selected security tests passed. No installer or deployment performed.\n'
