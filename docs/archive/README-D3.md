# PakPost Desktop D3 — Environments + History SQLite, Local-first startup

Incremental patch. Requires D1 SQLite + D2 Native HTTP installed. **Apply only to desktop branch, not VPS.**

## Included
- Native SQLite storage for **local environment definitions**, with `isSecret` values removed before disk writes. Secret values remain session-only (not restored after restarting desktop).
- Native SQLite local recent-request **metadata only** (method, sanitized URL, status, elapsed); no bodies, headers, bearer tokens or cookies saved. Query parameter names matching token/key/auth/password/etc. are redacted. URLs may still contain sensitive identifiers in paths or nonstandard query keys, so don't use this as a secure audit log.
- Async hydration gating: initial empty state will not overwrite existing desktop SQLite records. On failed load, saving remains disabled to protect existing data.
- Desktop Tauri startup skips automatic public `/api/auth/session` cookie check. Browser build retains current behavior.

## Apply
```bash
cd ~/riset-clean/pakpost-api-client
unzip -o /path/to/pakpost-desktop-d3-patch.zip -d .
cd frontend
bun install --frozen-lockfile
bunx tauri dev
```

## Verify
1. In Tauri Local mode, create an environment with a normal variable and an `isSecret` variable.
2. Exit Tauri completely and relaunch. Normal value persists; secret value must be blank. Re-enter it when needed.
3. Select Desktop Native; send a GET to localhost or an API you control. Recent requests metadata should remain after relaunch.
4. Disconnect internet; restart Tauri. Local collections/environments and local HTTP testing should work without a Google login. Other pieces of startup/feature UI can still be web-oriented until D4 is completed.
5. `bun run build` for browser should still compile; browser persistence and Google cookie bootstrap are unchanged.

## Important limits
- This does **not** establish fully offline operation of all features. Other startup effects, remote-only workspaces, browser assets, or application features may still need auditing.
- Database snapshots are not encrypted. Do not persist secret environment values; this patch stores them only in memory. For persistent secrets, implement OS keychain integration later.
- History is not full replayable request history; it intentionally omits headers/body. Cloud revision history is unchanged.
- No Desktop Public/Self-hosted auth or connection-manager yet. Desktop auth session probing is intentionally disabled until a secure desktop auth flow exists.
- Build/run under Debian must be tested by the user; Rust compilation was not executed in this environment.
