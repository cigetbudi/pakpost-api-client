# Privacy regression checks

The existing quality workflow discovers the Node and Playwright tests automatically. No new workflow, dependency, or network service is required.

- Static guard: checks known telemetry/analytics SDK names in npm and Cargo lockfiles and NuGet manifests (and lockfiles if present), and Google Fonts references in source CSS/entry HTML. Not a comprehensive dependency or code audit.
- Browser guard: loads the production guest workbench, opens the pre-request editor, waits for fonts and observes a bounded interval. Attempts at cross-origin HTTP(S) or WebSocket traffic fail the test; these requests are blocked by Playwright. Same-origin calls are permitted. No login, credentials or API execution. Service workers are blocked in this test.
- Desktop guard: optional interactive Linux test against an already-built production executable. Run from the repository root with `bash scripts/quality/verify-desktop-local-privacy.sh`; start in Local Mode, do not sign in or send requests, exercise normal editing and close the app. The temporary trace is private and deleted on exit. The guard rejects observed IP socket activity, not merely public destinations. It does not cover every syscall, independent OS/browser processes, or other platforms.

Quick checks:

```sh
cd frontend
node --test tests/network/privacyRegression.test.js
bun run build
bun run test:e2e -- e2e/privacyRegression.spec.js
```

These checks do not certify zero telemetry. Cloud mode intentionally uses the chosen server and authentication services; user-initiated API requests can reach their destinations. Server-side logging, SSO, website traffic, browser extensions and Windows/macOS need separate coverage. Keep operational logging distinct from product analytics. Do not upload traces or test with real secrets.
