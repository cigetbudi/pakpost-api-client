# PakPost Desktop Multi-Mode — implementation contract

**Status:** design/foundation only, **not** a shipped native desktop app. Web deployment stays untouched.

## Source realities observed in this repo

- React/Vite Workbench already has guest/local collections and environments, currently persisted with browser `localStorage` (`useWorkbenchController`, storage-scope utilities).
- Cloud auth relies on `HttpOnly` same-origin cookies, CSRF token, and Google Identity Services popup/credential flow (`httpClient.js`, `useBrowserSessionBootstrap`, `GoogleSignInButton`).
- Cloud realtime uses SignalR at `/hubs/workspace` with cookie and CSRF handling.
- A native shell using `tauri://localhost` cannot safely reuse that cloud login with a simple API-base-URL replacement.

## Modes & privacy

1. **Local (default):** no login, no backend checks, no PakPost account dependency; local SQLite for requests, collections, environments, history. No network needed for *app startup, login, or saving*. The user may deliberately send HTTP requests to external APIs. Protect stored secrets at rest with OS keychain/key wrapping and avoid storing plaintext environment secrets in SQLite. Native HTTP engine required for CORS-free requests.
2. **PakPost Public:** fixed `https://pakpost.duckdns.org`; Google login with system browser and secure loopback or app-link callback; cloud workspace data on public backend; preserve local storage as separate profile.
3. **Self-hosted:** user-defined origin (HTTPS), allow many named profiles. Validate origin scheme, no URL userinfo/fragment, no implicit trust of arbitrary certs; first fetch a non-sensitive instance-info/capabilities endpoint on the *chosen* server (endpoint must be added to backend). Support server-advertised authentication; do not silently send public account credentials to self-hosted instances.

## Recommended layout

```
frontend/src/platform/                  # runtime / workspace provider contracts
frontend/src/platform/local/            # SQLite repository, native HTTP engine
frontend/src/platform/cloud/            # authenticated API repository + SignalR
frontend/src/platform/connections/      # named remote profiles; per-instance tokens
frontend/src-tauri/                     # Rust commands, capabilities, updater
```

UI should expose a first-run selector (Local, PakPost Cloud, Add Server), a profile switcher in settings, and explicit Copy/Move operations. Never automatically sync Local data to remote. A move deletes source only after confirmation and verification. Sensitive environment values require a separate opt-in to copy.

## Staged work

**D1:** introduce a platform/repository interface and tests without changing web behaviors; implement SQLite schema and migration/versioning. Test offline from app startup, not just after loading UI.

**D2:** Tauri v2 shell, native HTTP engine with cancellation, streaming, cookie isolation and explicit filesystem permissions. Support Win/macOS/Linux; never disable TLS checks globally. Add isolation tests for offline Local and remote profiles.

**D3:** design native OAuth with backend; don't embed the existing Web Google login in a Tauri WebView and assume it works. A secure approach is system browser + short-lived authorization code + PKCE, loopback redirect or verified app link. Requires backend changes and security tests (state, replay, CSRF, token storage). Restrict per-profile cookie/token domains.

**D4:** server discovery/version API, named self-hosted profiles, SSO compatibility, reconnect and SignalR. Ensure one profile cannot read another's secrets or cache.

**D5:** CI release workflows: `.deb`, `.rpm` on Linux, NSIS `.exe` on Windows, `.dmg` on macOS x64/arm64. Sign Windows and Apple builds; notarize macOS. Publish checksums and signed updater manifests; stage rollouts and provide rollback versions.

Use shared React UI, not multiple frontend implementations. Tauri native functionality is optional for web builds; do not import Tauri APIs in web entrypoint. Local-only model must not access `pakpost.duckdns.org` at startup. Web offline mode is a separate PWA question and browser localStorage is not the final SQLite persistence solution.
