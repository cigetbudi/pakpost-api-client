# PakPost Option B + D4/D5 foundation

Based on `pakpost-api-client-source-clean(6).zip` containing working D1–D3 Rust commands.

## Apply
1. On your `feature/desktop` branch, commit/stash local changes. **Back up SQLite** (including `-wal`/`-shm` if present) while Tauri is stopped.
2. Unzip this patch **at repository root**. Note that ZIP extraction does not remove `frontend/src-tauri`.
3. Run `bash scripts/desktop/apply-relocation.sh`. It preserves the old tree as a timestamped backup only if old/new native sources match; otherwise it leaves it in place.
4. `cd frontend && bun install`, `cd ../desktop && bun install`, `bun run dev`.
5. In Settings > Desktop connections, verify Local and PakPost Cloud profiles and add a self-hosted HTTPS URL.
6. Close/restart; confirm profiles persist, then test existing collections, environments, history, and Native HTTP localhost.
7. If successful, `bun run build:deb` from desktop; test installing and launching package separately from `tauri dev`.

## Behavior
- Tauri identifier `app.pakpost.desktop` preserved; SQLite path unchanged.
- Remote backend APIs are explicitly blocked inside Tauri until native login/session flow is implemented, preventing silent cloud calls in Local Mode.
- Connection profiles do **not** include tokens/cookies/passwords; server profiles validate HTTPS host and persist in SQLite.
- Public/Self-Hosted *profile configuration exists*, but authenticated desktop workspace sync DOES NOT. Use web PakPost for remote work until proper external browser auth handoff is added.
- Web source changes include a settings item only shown in Tauri, plus a desktop-only guard in httpClient. Web continues unaffected functionally but still requires its normal checks before future deployment.

## Regression checklist
- Existing SQLite collections/environments/history rehydrate after restart.
- Native Rust request to http://127.0.0.1:8765 succeeds.
- Disconnect internet; restart app, edit/save Local Environment, make native localhost request.
- No calls to pakpost.duckdns.org in Local Mode (inspect Network). Third-party editor tooling may still attempt network depending on future features.
- `cd frontend && bun run build` still works.
- Check Rust compile from `cd desktop && bun run dev` on Debian.

## Next engineering increment
Add server instance metadata endpoint, auth PKCE/state + system browser deep-link/loopback callback, short-lived one-time code exchange, OS credential vault, per-instance API session transport, strict origin isolation, remote providers and desktop release signing/updater. This requires coordinated backend changes and production migration planning, not just a URL selector.
