#!/usr/bin/env bash
# Local, non-deploying release check. Run after bun install --frozen-lockfile.
set -uo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." || exit 1
if ! command -v bun >/dev/null 2>&1; then echo 'Bun is required.' >&2; exit 1; fi
failed=()
run() {
  local label=$1; shift
  printf '\n=== %s ===\n' "$label"
  if "$@"; then printf '[PASS] %s\n' "$label"; return 0; fi
  printf '[FAIL] %s\n' "$label" >&2
  failed+=("$label")
  return 1
}
run 'Source imports' bun run verify:imports
run 'All unit and architecture tests' bun run test:node
if run 'Production build' bun run build; then
  run 'Production bundle budget' bun run perf:check
  run 'Production browser regression' bun run test:e2e
else
  printf '[SKIP] Bundle and browser tests: production build failed.\n' >&2
fi
printf '\n=== Release gate ===\n'
if ((${#failed[@]})); then printf '[FAIL] %s\n' "${failed[@]}" >&2; exit 1; fi
printf '[PASS] All configured checks passed. No deployment was performed.\n'
