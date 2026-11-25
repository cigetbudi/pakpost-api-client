# Testing and quality gates

Tests are grouped by runtime and purpose. Node's built-in test runner is canonical for `frontend/tests` (including architecture/contract guards); Bun remains the package manager and build runner. Do not interpret a source-text architecture guard as proof of runtime behavior.

## Commands from repository root

| Command | Scope |
| --- | --- |
| `make test-frontend` | Import graph + Node tests; no browser or database |
| `make test-backend` | .NET unit tests + Mediator migration guard |
| `make test-docker` | Static frontend server tests |
| `make test` | All three above |
| `make build` | Frontend production bundle + budget, backend solution build |
| `make test-desktop` | Frontend build + Cargo check/test (locked); no installer |
| `make test-security` | .NET security checks + QuickJS browser tests |
| `make test-e2e` | Production Vite build + Playwright guest/mocked tests |
| `make test-integration` | Explicit disposable PostgreSQL integration tests |
| `make test-all` | Default tests, build, desktop, browser and security; excludes database integration and advisory/network load tests |
| `make audit` | Online dependency advisory reports |

Run `make help` to see supported targets. Without Make, run `bash scripts/quality/check.sh <target>` (Git Bash/WSL on Windows, native toolchains as appropriate). Commands fail on errors and identify prerequisites. Install frontend/desktop dependencies using `bun install --frozen-lockfile` in each directory. Standard tests do not read a production `.env` or run migrations. Existing phase-specific verification scripts remain available for targeted regressions; prefer the root commands for new work.

## Browser tests

```bash
cd frontend
bun x playwright install chromium
bun run build
bun run test:e2e
bun x playwright test --config playwright.security.config.js
```

On Linux install Playwright system dependencies when needed (`bun x playwright install --with-deps chromium`). To also exercise Firefox and WebKit, install those browsers and use `PAKPOST_CROSS_BROWSER=1 bun run test:e2e`. WebKit on desktop is not a substitute for testing Safari on iPhone or Tauri's actual platform WebView. Guest E2E and QuickJS tests do not require a real cloud account; authenticated realtime, keyring, and production pairing need manual or dedicated integration verification. The security browser config intentionally disables traces/screenshots/video.

## Database integration (opt-in)

Copy `backend/.env.integration.example` to `backend/.env.integration` and fill a **disposable** database named `pakpost_integration_*` (not a production database or its live branch). The integration suite runs migrations and may mutate test data. The confirmation value is required. The separate integration project is not part of `Pakpost.slnx`, so `dotnet test` on the solution alone is not integration coverage.

```bash
make test-integration
```

## Performance and load tests

`make build` runs Vite's manifest-based gzip budgets (initial JS 300 KiB, CSS 60 KiB, editor lazy chunk 250 KiB, console 10 KiB). `cd frontend && bun run perf:audit` prints the complete metrics. Do not raise budgets just to hide a regression.

Install k6 separately on a load-generator machine. The existing read-only script ramps to five VUs for 90 seconds, with 1–2 seconds think time and thresholds p95 < 1000 ms, HTTP errors < 1%, failed checks < 1%. This is a baseline smoke load, not maximum capacity proof.

```bash
# Local instance:
BASE_URL=http://localhost:8080 k6 run scripts/load/pakpost-readonly.k6.js
# Only on an instance you operate, after explicit approval:
BASE_URL=https://api.example.com ALLOW_REMOTE=YES k6 run scripts/load/pakpost-readonly.k6.js
```

Authenticated mode uses a dedicated test account's session (`PAKPOST_SESSION`) and `MODE=authenticated`. Set the secret without echoing it (e.g. Bash `read -rsp 'Test session: ' PAKPOST_SESSION; echo; export PAKPOST_SESSION`); unset it afterwards and revoke the test session. Do not enable HTTP debug dumps or publish raw credentials. The script never exercises mutating endpoints or Secure Proxy, and remote load is not part of CI.

## Test design and acceptance

Prefer behavioral tests for new functionality, use mocks at external boundaries, and retain architecture guards for actual dependency/security contracts. Existing source-text checks are not interchangeable with browser/DB tests. Do not remove assertions merely to reduce the test count. For a release, check real Google login, multi-account RBAC, invitations and member removal, realtime fallback/revocation, desktop restart/keyring, local data, iPhone Safari and backup restore. Record failures, actual runtime versions and skipped checks. CI introduced here is a proposed automated verification workflow; a green run must be observed before claiming CI passed.
