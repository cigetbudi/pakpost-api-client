# PakPost Desktop — separated Tauri project

**Do not deploy this branch or desktop folder to the VPS.** The existing web production is independent.

Prerequisites: Bun, Rust, GTK/WebKit development libraries, and `bun install` in `frontend/` and `desktop/`.

```bash
cd frontend && bun install
cd ../desktop && bun install
bun run dev
```

`desktop/src-tauri/tauri.conf.json` builds frontend assets from `../../frontend/dist`. The desktop app identifier stays `app.pakpost.desktop`, so SQLite at the existing app data directory remains intact.

To build on Linux: `bun run build:deb` or `bun run build:rpm`.

**Current limitations:** Local collections, environments, and history use the existing SQLite commands; Native HTTP still works. Connection profiles persist in SQLite, but remote Google SSO and custom-server session exchange are *not* implemented. The manager intentionally disables remote sign-in rather than pretending that a remote base URL is authenticated. Full offline behavior for all third-party scripts and optional integrations still needs an offline network audit.
