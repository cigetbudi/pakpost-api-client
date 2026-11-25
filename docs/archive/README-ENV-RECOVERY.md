# PakPost Desktop D3 Environment Recovery hotfix

## Why
D3 initialized Local Environments from an empty list and disabled browser localStorage writes, but did not migrate the pre-D3 `pakpost_guest_envs` snapshot to SQLite. This made older saved environments appear missing. In addition, the UI previously said "Environment saved" before the asynchronous SQLite operation was known to have succeeded.

## What this hotfix does
- If SQLite contains environments, trust those records.
- If SQLite has no environments but the legacy localStorage key has them, recover into SQLite **before** hydrating UI.
- Preserve the legacy storage key as a backup (never delete it).
- Strip secret variable values while persisting.
- If load/save errors occur, show a visible notice rather than only logging to console.

## Limitations
- If SQLite and localStorage are both empty, this cannot resurrect removed data.
- If user intentionally emptied SQLite but legacy localStorage still has old values, this fallback restores those old environments. After recovery verify and delete unwanted entries. Future migrations should use an explicit versioned migration marker instead.
- Existing localStorage may depend on the WebView's origin; changing app identity/origin may make it inaccessible.
- Desktop environment UI currently reports save completion before SQLite promise resolves; UI status wording should eventually be driven by persisted completion.

## Usage
1. Quit Tauri and stop the dev process.
2. **Back up** Tauri's app-data SQLite file (`pakpost-local.sqlite3` and any `-wal`/`-shm` files if present) and, if possible, export `localStorage['pakpost_guest_envs']` from the Tauri WebView console to a private JSON backup. Do not post secrets.
3. Extract this ZIP at repository root. Two files are modified.
4. `cd frontend && bunx tauri dev`.
5. Verify old environments appear, close/reopen app, and check persistence. Watch console for SQLite errors.

No backend or VPS changes required.
