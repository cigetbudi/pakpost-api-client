# Development

Use Bun 1.4.4 (the frontend's declared package manager), Node.js 22 for regression tests, .NET SDK 10, Git and Bash. Desktop also requires Rust 1.90+ and platform dependencies. Use `bun.lock` and `Cargo.lock` as the reproducible dependency inputs. Do not mix npm and Bun dependency installation in the same checkout.

```bash
(cd frontend && bun install --frozen-lockfile)
(cd desktop && bun install --frozen-lockfile)
```

For guest/local browser work, run `cd frontend && bun run dev` and visit http://127.0.0.1:5173. The Vite server proxies `/api`, `/health`, and `/hubs` to port 5080; cloud functions require a backend. For local cloud development, configure `backend/.env` and `frontend/.env` from their examples, use a development PostgreSQL database, register the exact Vite origin in Google OAuth and follow the database review steps in [installation](installation.md).

```bash
# From root, review database and migrations before applying:
(cd backend && bash scripts/apply-migrations.sh --apply)
# Terminal 1:
bash backend/scripts/run.sh
# Terminal 2:
cd frontend && bun run dev
```

Do not use `backend/scripts/init.sh` on this repository: migrations already exist. Backend launch script reads `backend/.env` and binds to 127.0.0.1:5080 in the example. For desktop use `cd desktop && bun run dev` (do not also launch a Vite server on the same port).

## Repository layout

| Directory | Responsibility |
| --- | --- |
| `frontend/src/features` | Workbench, requests, collections, auth and settings |
| `frontend/src/platform` | Runtime-specific storage/network adapters |
| `frontend/tests`, `frontend/e2e`, `frontend/e2e-security` | Node, browser and sandbox tests |
| `backend/src/Pakpost.Domain` | Domain entities and invariants |
| `backend/src/Pakpost.Application` | Commands, queries, Mediator handlers and contracts |
| `backend/src/Pakpost.Infrastructure` | EF Core, crypto and external service implementations |
| `backend/src/Pakpost.Api` | HTTP controllers, middleware, authentication and SignalR |
| `backend/tests`, `backend/tools` | Test projects and key rotation tool |
| `desktop/src-tauri` | Canonical Tauri Rust application and capabilities |
| `extension` | Browser interceptor sources and build scripts |
| `docker` | Runtime images, Caddy and static server |
| `scripts` | Quality, operations, security, load test and legacy migration utilities |

Browser interceptor development: `bash extension/build.sh`, then load the appropriate unpacked `extension/dist/chrome` or `extension/dist/firefox` directory using the browser's developer extension tooling. Review permitted origins and trust implications. It is optional and distinct from native desktop networking.

Use [testing](testing.md) before merging. See [desktop](desktop.md) for native development.

## Retiring historical files

`docs/archive/` contains historical patch notes, not current installation steps. The canonical native tree is `desktop/src-tauri`. The old `frontend/src-tauri` tree and `.pakpost-patch-backups` should not be tracked. After reviewing and backing up any local-only changes, use `bash scripts/quality/untrack-legacy.sh` for a dry run and add `--apply` to stage removal from Git (files stay on disk). This also untracks known local SSH key filenames. It does not rotate keys or rewrite history. Move sensitive files outside the checkout; do not force-add them. `frontend/package-lock.json` is intentionally retained until the frozen Bun build and CI have passed; Bun is the documented canonical lockfile.

For a source review archive, use `bash zip-pakpost-source.sh` with Python 3 installed. The exporter excludes known sensitive filenames and private-key markers even if tracked. It cannot detect all secrets; inspect the archive manually before sharing. Do not use a plain `git archive` as a secret filter.
