#!/usr/bin/env bash
# Local quality gates. No deployment, installer, or implicit database migrations.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
need() { for cmd in "$@"; do command -v "$cmd" >/dev/null || { echo "Missing prerequisite: $cmd" >&2; return 1; }; done; }
frontend() { need node; (cd frontend && node scripts/check-source-imports.mjs && node --test tests/*/*.test.js); }
backend() { need dotnet; bash backend/tests/check-mediator-migration.sh; dotnet test backend/tests/Pakpost.UnitTests/Pakpost.UnitTests.csproj; }
static_server() { need node; node --test docker/tests/static-server.test.mjs; }
frontend_build() { need bun node; (cd frontend && bun run build && bun run perf:check); }
backend_build() { need dotnet; dotnet build backend/Pakpost.slnx; }
desktop() { need cargo; (cd desktop/src-tauri && cargo check --locked && cargo test --locked); }
security_backend() { need dotnet; dotnet run --project backend/tests/Pakpost.SecurityChecks/Pakpost.SecurityChecks.csproj; }
security_browser() { need bun; (cd frontend && bun x playwright test --config playwright.security.config.js); }
e2e() { need bun; (cd frontend && bun run test:e2e); }
audit() { need bun dotnet cargo-audit; (cd frontend && bun audit); (cd backend && dotnet list Pakpost.slnx package --vulnerable --include-transitive); (cd desktop/src-tauri && cargo audit); echo 'Review all advisory output; NuGet list may not return a failing exit code for advisories.'; }
help() { cat <<'HELP'
Usage: bash scripts/quality/check.sh <target>
  test-frontend   Node regressions and import graph
  test-backend    .NET unit tests and Mediator guard
  test-docker     Static server tests (Node only)
  test            Frontend, backend, static server tests
  build           Production frontend + budget, backend build
  test-desktop    Cargo check/test (no packaging)
  test-e2e        Frontend build + production browser tests
  test-security   Backend security checks + QuickJS browser tests
  test-integration  Explicit disposable PostgreSQL tests
  test-all        Test + build + desktop + browser + security (no integration/load/audit)
  audit           Online advisory scans (requires cargo-audit)
HELP
}
case "${1:-help}" in
  help) help ;;
  test-frontend) frontend ;;
  test-backend) backend ;;
  test-docker) static_server ;;
  test) need node dotnet; frontend; backend; static_server ;;
  build) need node bun dotnet; frontend_build; backend_build ;;
  test-desktop) need cargo bun; frontend_build; desktop ;;
  test-e2e) frontend_build; e2e ;;
  test-security) need dotnet bun; security_backend; security_browser ;;
  test-integration) need dotnet; bash backend/scripts/verify-postgres-integration.sh ;;
  test-all) need node bun dotnet cargo; frontend; backend; static_server; frontend_build; backend_build; desktop; e2e; security_backend; security_browser ;;
  audit) audit ;;
  *) help >&2; exit 2 ;;
esac
