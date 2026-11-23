# PakPost Desktop D2 — Native HTTP transport

This is an **incremental patch** applied **after** the D1 SQLite patch. This version is based on `pakpost-desktop-current.zip` overlaid with `pakpost-desktop-sqlite-patch.zip`. Apply on the desktop feature branch, **never deploy this branch to your public VPS**.

## What changed
- Adds the desktop-only **Desktop Native** interceptor, selected by default in a clean Tauri profile. Existing browser interceptors remain unchanged.
- Native requests run through a Tauri Rust command (`reqwest`) and **never use the PakPost server proxy**. Supports GET/HEAD, raw body, urlencoded, multipart, binary uploads and custom request headers; uses the existing pre/post script execution path.
- Localhost/LAN targets work without browser CORS restrictions. The app makes direct outbound HTTP(S) requests from the user's own machine.
- Request limits: 25s timeout (10s connect), up to 16 MiB upload, up to 1 MiB response. Redirects are deliberately blocked; protocol framing headers are rejected. Automatic cookie handling is disabled.

## Install
From repository root:

```bash
unzip -o /path/to/pakpost-desktop-native-http-patch.zip -d .
cd frontend
bun install --frozen-lockfile
bunx tauri dev
```

## Test
1. Open Settings -> Interceptor; choose **Desktop Native**.
2. In another terminal: `python3 -m http.server 8765 --bind 127.0.0.1`
3. Send `GET http://127.0.0.1:8765/` in PakPost Desktop. You should see HTTP 200 and HTML; the VPS backend is not involved.
4. Test POST/JSON against a test service you control. Avoid credentials in shared screenshots or logs.
5. Restart Tauri; the interceptor choice is persisted.
6. Run `bun run build` to verify web compilation; **Desktop Native must not appear in the browser settings UI**.
7. To build Linux installer after Rust dependencies are available: `bunx tauri build --bundles deb`.

## Known limitations / next work
- This patch **does not** finish full offline startup, all local SQLite data, Public/Self-Hosted connection manager, desktop Google auth, cookies, local file-picker integration, or auto-updater. D1 only persisted Local Collections. Some UI initialization may still attempt cloud API calls.
- Native HTTP does not follow redirects; use the final target URL directly.
- This patch is not compiled/tested on the user's Debian device in this environment; run Tauri locally and send any Rust compiler errors. Frontend static checks are limited.
- Desktop Native allows access to private addresses by design, and must only be used to test endpoints you are authorized to reach. It does not expose a remote proxy.
