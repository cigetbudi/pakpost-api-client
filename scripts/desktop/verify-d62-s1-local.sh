#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
root="$PWD"
for cmd in node bun cargo dotnet; do
  command -v "$cmd" >/dev/null || { echo "Missing local tool: $cmd" >&2; exit 1; }
done
(cd "$root/frontend" && bun run test:node && bun run build)
(cd "$root/desktop/src-tauri" && cargo check --locked && cargo test --locked)
dotnet test "$root/backend/tests/Pakpost.UnitTests/Pakpost.UnitTests.csproj"
dotnet run --project "$root/backend/tests/Pakpost.SecurityChecks/Pakpost.SecurityChecks.csproj"
# Explicit opt-in: these checks contact advisory feeds. No deployment or DB migration.
if [[ "${1:-}" == "--audit" ]]; then
  (cd "$root/frontend" && bun audit)
  (cd "$root/backend" && dotnet list Pakpost.slnx package --vulnerable --include-transitive)
  if cargo audit --version >/dev/null 2>&1; then
    (cd "$root/desktop/src-tauri" && cargo audit)
  else
    echo 'cargo-audit not installed; Rust advisory scan NOT performed.' >&2
  fi
fi
echo 'Local verification finished. Test actual WebSocket and fallback in Tauri; advisory reports require review.'
