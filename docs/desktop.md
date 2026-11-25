# Desktop application

The canonical Tauri project is `desktop/src-tauri`, identifier `app.pakpost.desktop`. It shares `frontend/` rather than maintaining a second React application. Run commands from the repository root unless otherwise stated.

## Prerequisites

Bun 1.4.4, Rust stable (manifest minimum 1.90), and Tauri v2 prerequisites for your OS. On Debian/Ubuntu a typical development setup includes:

```bash
sudo apt install build-essential curl pkg-config libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev libssl-dev libxdo-dev libdbus-1-dev
```

Use the distro's supported package names and follow the official [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). On macOS install Xcode Command Line Tools (`xcode-select --install` if needed). On Windows use MSVC build tools and WebView2. Linux persistent login needs an unlocked compatible Secret Service implementation; without one, use memory-only login.

```bash
(cd frontend && bun install --frozen-lockfile)
(cd desktop && bun install --frozen-lockfile)
cd desktop
bun run dev
```

Tauri launches Vite automatically at port 5173. Local mode supports native HTTP and SQLite without server login. Cloud connection profiles use browser pairing; enable `DESKTOP_AUTH_ENABLED=true` on a compatible HTTPS server, and select the server in Desktop Connections. Opt in to Keep me signed in to store the session in the operating system's credential vault. Expired/revoked sessions require sign-in again.

## Build optional local installers

On Debian/Ubuntu:

```bash
cd desktop
bun run build --bundles deb
ls -lh src-tauri/target/release/bundle/deb/
# Optional installation: sudo apt install ./src-tauri/target/release/bundle/deb/<actual-file>.deb
```

On macOS:

```bash
cd desktop
bun run build --bundles dmg
ls -lh src-tauri/target/release/bundle/dmg/
```

Universal macOS build (on macOS):

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
bun run build --bundles dmg --target universal-apple-darwin
```

Output is under `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`. Names depend on the bundler. These commands do not publish a release. The manual `desktop-build.yml` workflow builds platform installers, but signing, notarization and auto-update are not configured as release guarantees. Gatekeeper may reject unsigned downloads. Do not bypass system security globally.

If AppImage download stalls, specify `--bundles deb` rather than building every Linux format. Close development instances before starting a packaged build against the same local database. Local database and keyring are not deleted by building an installer.

## Install a downloaded package

Use the official PakPost download center or the application repository’s published release assets to obtain installers and SHA-256 checksums. Only install a verified artifact for your OS and architecture. On Linux, download the appropriate package and check its hash (`sha256sum <file>`). For Debian/Ubuntu use `sudo apt install ./<actual-file>.deb`; for Fedora use `sudo dnf install ./<actual-file>.rpm`. Install system dependencies through your distribution.

On macOS, check `shasum -a 256 <file>`, mount the DMG and copy PakPost to Applications. Choose Apple Silicon, Intel or universal as appropriate. Follow macOS security policy; unsigned or unnotarized builds may be blocked. On Windows, compare `Get-FileHash <file> -Algorithm SHA256` in PowerShell and run the verified NSIS setup executable. WebView2 is required. Windows SmartScreen or organizational policy may block unsigned installers. No official signing or notarization guarantee is made.

To build RPM on Linux: `cd desktop && bun run build --bundles rpm`. To build NSIS on Windows, install the required MSVC and Tauri toolchain first, then run `bun run build --bundles nsis` in `desktop/`.

## Official Cloud domain transition

New desktop builds use https://app.pakpostapi.com as the built-in PakPost Cloud origin. Existing built-in profiles using https://pakpost.duckdns.org are normalized on load; self-hosted profiles and local data are unchanged. Sign in again at the new origin: saved credentials are origin-bound and must not be forwarded. Older desktop builds can continue using the legacy origin while it is served. Before downgrading, back up the local database and review the public profile URL; older builds do not accept the new built-in URL.
