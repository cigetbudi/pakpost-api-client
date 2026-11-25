# PakPost Desktop Remote Workspace — D5 Auth Patch (experimental)

**Apply from repository root** on `feature/desktop-tauri`. This patch assumes the Option B desktop relocation is installed and the previous Rust `profiles.rs` hash-set error is fixed (the patch includes that fix). Keep the production server untouched until compilation and tests pass.

## What this patch implements

- New **device pairing** protocol: desktop Rust obtains a one-time secret, opens the SYSTEM BROWSER at the selected instance `/desktop-connect?request=...`; user signs in via the existing Google web flow and explicitly approves; desktop polls with its secret.
- Distinct `Authorization: PakpostDesktop <opaque-token>` accepted by the existing session handler. JWT bearer tokens are still rejected, browser HttpOnly cookies and CSRF behavior are preserved.
- Desktop holds the opaque token in **Rust process memory only**; never in SQLite, React state, browser storage, or the browser pairing URL. Restart requires reauthentication.
- Existing React workspace REST API goes via Tauri `remote_api` to the **selected HTTPS origin only**, with no redirects. Local Mode continues to block all cloud API calls.
- One-to-many Self-Hosted profiles supported by the existing Connection Manager, each with its own Rust session. Remote workspaces, collection API CRUD, and environments use existing backend REST routes.
- Disconnect and logout revoke a server session. No automatic local data upload.

## Known limitations / not yet completed

- The pairing store is in-memory per backend process with a five-minute TTL. **Single backend instance only**; use Redis/DB for multi-replica production.
- Google web SSO must be configured independently on each Self-Hosted server (correct authorized JavaScript origin). The current backend does not provide an alternate desktop password sign-in.
- Desktop SignalR realtime is disabled; REST operations work but collaboration requires refresh/re-fetch.
- Session is memory-only and not restored after desktop process restart. Browser approval is required again.
- Backend and Rust compilation could **not** be performed in the packaging environment (no dotnet/cargo). Consider this patch *experimental until verified*.
- No installer or auto-updater work included.

## Apply

1. Stop Tauri; back up the SQLite DB if desired: `~/.local/share/app.pakpost.desktop/pakpost-local.sqlite3` (and WAL/SHM after Tauri exit).
2. Ensure `git status --short` is clean or commit/stash changes.
3. From repo ROOT: `unzip -o ~/Downloads/pakpost-d5-remote-auth-workspace.zip -d .`
4. `source ~/.cargo/env` if needed.
5. `cargo fmt --manifest-path desktop/src-tauri/Cargo.toml`
6. `cargo check --manifest-path desktop/src-tauri/Cargo.toml`
7. `dotnet build backend/src/Pakpost.Api/Pakpost.Api.csproj` (use the actual solution path if project layout changed).
8. `dotnet test backend/tests/Pakpost.IntegrationTests/Pakpost.IntegrationTests.csproj` and the usual security tests.
9. `cd frontend && bun install && bun run build` (return root).
10. **Only on a test/staging backend instance**: set `DesktopAuth__Enabled=true`, rebuild/redeploy that backend plus the updated frontend (needed for `/desktop-connect`). Leave the live VPS unchanged until tests pass.
11. `cd desktop && bun run dev`; Settings > Desktop connections > choose Self-Hosted staging profile > Sign in via browser. Open/login in system browser, return to approval tab, click Approve. Desktop should reload with remote workspace authenticated.
12. Test list/create/delete on a disposable staging workspace; test logout and session revocation; then switch back to Local and verify unchanged SQLite data.

**IMPORTANT**: A desktop-only patch cannot sign in to an unpatched production server. `/api/desktop-auth/start` returns 404 until the matching backend is deployed **and** `DesktopAuth__Enabled=true` is set. Do not turn that flag on without security and integration tests.

## Security smoke checks

- Browser cookie login and CSRF checks must still pass unchanged.
- Anonymous `/api/workspaces` -> 401; fake JWT `Authorization: Bearer ...` -> 401.
- `/api/desktop-auth/start` -> 404 while flag disabled.
- When enabled: request ID without the device secret cannot consume approval; consumed secret fails again; expired pairing fails.
- Unapproved pairing never yields a desktop session.
- Desktop cannot use arbitrary user-supplied hosts or HTTP redirects in remote API requests.
- `git diff -- backend frontend desktop` before deploying; never sync desktop branch automatically to the live VPS.
