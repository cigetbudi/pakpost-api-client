# PakPost patch: production updates + desktop design foundation

This patch adds production release scripts, a tested non-secret connection profile model, and the desktop implementation contract. It deliberately **does not** claim to implement desktop SQLite, native request transport or native Google login yet: these require deliberate refactors of the existing Workbench auth/data layers.

Copy the overlay into your repository root, preserving paths. Example from your PC:

```bash
unzip pakpost-desktop-deploy-foundation.zip -d /tmp/pakpost-patch
cp -a /tmp/pakpost-patch/. /path/to/pakpost-api-client/
```

The patch is additive, without rewriting `.gitignore`. Append `.pakpost-last-backup*` to the existing `.gitignore` manually. Append `.pakpost-last-backup*` to the existing repository `.gitignore` before committing. It does not modify the running public site until you sync files and run deployment commands. Read `docs/PRODUCTION-UPDATES.md` before the next web update; read `docs/DESKTOP-MULTIMODE-ARCHITECTURE.md` before starting Tauri.
