#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
root=$PWD
usage(){ echo 'Usage: verify-s2-local.sh [--audit] [--integration] [--browser]'; }
audit=0; integration=0; browser=0
for arg in "$@"; do case "$arg" in --audit) audit=1;; --integration) integration=1;; --browser) browser=1;; *) usage; exit 2;; esac; done
# Preserve existing D6/S1 gates. No installer, deployment or automatic migration.
bash scripts/desktop/verify-d62-s1-local.sh
(cd frontend && bun run perf:audit && bun run perf:check)
if ((browser)); then
  (cd frontend && bun run test:e2e && bun x playwright test --config playwright.security.config.js)
else echo 'SKIPPED: Browser and real QuickJS tests; use --browser'; fi
if ((integration)); then bash backend/scripts/verify-postgres-integration.sh
else echo 'SKIPPED: Disposable PostgreSQL tests; use --integration'; fi
if ((audit)); then
  command -v cargo-audit >/dev/null || { echo 'cargo-audit required for complete Rust scan' >&2; exit 1; }
  (cd frontend && bun audit)
  (cd backend && dotnet list Pakpost.slnx package --vulnerable --include-transitive)
  (cd desktop/src-tauri && cargo audit)
  echo 'Review all NuGet advisories; dotnet list does not necessarily fail for vulnerabilities.'
else echo 'SKIPPED: Online advisory scans; use --audit'; fi
echo 'S2 local checks completed. Review skipped gates and manually verify Tauri CSP, realtime, and keyring.'
