# PakPost D5 — Desktop Header Sign in Fix

Target: `feature/desktop-tauri`, run from repository root. No VPS deploy needed.

Issue: clicking **Sign in** in the Tauri top-right header opens Google Identity Services inside WebView, producing origin errors. Desktop must use browser-based device pairing via **Settings → Desktop connections**.

## Apply

```bash
cd ~/riset-clean/pakpost-api-client
unzip -o ~/Downloads/pakpost-d5-desktop-header-signin-fix.zip -d .
python3 scripts/patches/apply-desktop-header-signin.py
cd frontend && bun run build
cd ../desktop && bun run dev
```

The patcher applies to **current source** instead of overwriting potentially newer files. It checks all anchor points before writing; re-running is safe. Review with `git diff -- frontend/src/components/layout/AppHeader.jsx frontend/src/app/components/WorkbenchView.jsx`.

Expected: web header **Sign in** opens normal Google login; Tauri header **Sign in** opens Settings > Desktop connections; Local SQLite collections/environments remain intact.

Note: this corrects header navigation only. It does not automatically merge browser session state with desktop remote session state; remote workspace and logout still need end-to-end validation.
