# Backup and recovery

Backups contain sensitive requests, credentials and operational metadata. Encrypt them, limit access and keep an off-host copy. Verify recovery before relying on a backup. Keep the following together in a recovery inventory, but restrict access to keys separately:

| Asset | Recovery requirement |
| --- | --- |
| PostgreSQL | Consistent backup or provider restore point; test in an isolated database |
| Workspace encryption | Master key(s), key IDs and legacy environment encryption key |
| ASP.NET Data Protection | Both key ring and RSA certificate/private key under `/var/lib/pakpost/data-protection/` |
| Caddy | Persistent `caddy_data` and `caddy_config` volumes; protect TLS private keys |
| Instance config | Root `.env`, Compose and Caddy version; keep secrets out of Git |
| Desktop | SQLite committed state; OS credential vault separately, or reauthenticate |

## Desktop SQLite

On Linux the app data directory is typically `~/.local/share/app.pakpost.desktop/`. Confirm the actual platform app-data path. With SQLite CLI installed, use the existing online backup helper (captures committed WAL state and verifies an isolated copy):

```bash
mkdir -m 700 -p "$HOME/pakpost-private-backups"
bash scripts/security/backup-local-sqlite.sh \
  "$HOME/.local/share/app.pakpost.desktop/pakpost-local.sqlite3" \
  "$HOME/pakpost-private-backups"
```

Never overwrite an open database. Before a real restore, stop all app instances, keep the current DB and sidecar files as a separate recovery copy, verify the restored SQLite database, and start the app only after replacement is complete. The helper does not back up the OS credential vault.

## PostgreSQL

Use the database provider's backup mechanism or trusted custom-format `pg_dump`; do not pass credentials on the command line. The existing `scripts/security/verify-postgres-backup.sh` starts a disposable PostgreSQL container with no network, restores a trusted dump, and checks for the required `auth.users` and `organization.workspaces` relations. Use a locally available matching-major official image. This is a structural rehearsal only. Verify the application schemas (`auth`, `organization`), row counts, migrations, key availability and decryption using an isolated app instance before actual recovery.

App rollback (`scripts/production/rollback.sh`) does not restore the database or keys. Do not regenerate a workspace master key or Data Protection certificate to fix decryption errors. The offline key-rotation tool requires preserving the old key and verified backups; inspect the existing tool and plan a controlled maintenance window. Never execute an unreviewed rotation or downgrade production schema.
