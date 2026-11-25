# PakPost Desktop

This is the canonical Tauri v2 project. It shares the React workbench in `../frontend`.

See [desktop setup and installer builds](../docs/desktop.md), [development](../docs/development.md), and [testing](../docs/testing.md). Local mode uses SQLite and native HTTP; remote profiles support browser pairing and optional OS credential-vault persistence. No server account is needed for local use.

From the repository root:

```bash
(cd frontend && bun install --frozen-lockfile)
(cd desktop && bun install --frozen-lockfile)
cd desktop
bun run dev
```
