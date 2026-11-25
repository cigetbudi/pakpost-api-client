# D5 remote login: consolidated rollout

Source baseline: last uploaded cleaned D5 archive (before the user's subsequent local edits). This patch does **not** overwrite any locally modified desktop source and removes no user data.

## Security changes
- Remove duplicated `DesktopPairingStore` DI registration.
- Make `DesktopAuth__Enabled=false` reject existing `PakpostDesktop` session tokens, not just `/desktop-auth` endpoints.
- Keep the recently patched user-controller intact. Confirm `Cache-Control: no-store` is applied to pairing responses before wider rollout.
- Docker Compose passes `DesktopAuth__Enabled` from `DESKTOP_AUTH_ENABLED` and defaults it OFF.
- No user allowlist. Existing CSRF protection and workspace authorization are retained.

## Local: one verification command

```bash
cd ~/riset-clean/pakpost-api-client
unzip -o ~/Downloads/pakpost-d5-onepass-release.zip -d .
source ~/.cargo/env
bash scripts/production/d5-verify-local.sh
cd backend && ./scripts/verify-postgres-integration.sh
```

## VPS rollout (after local checks)

**Do not rsync the desktop branch wholesale to live VPS.** Create and review a *backend/frontend-only* release bundle and ensure `docker/backend.Dockerfile` and `docker/frontend.Dockerfile` remain available. They were missing from the source-sharing ZIP. Sync only the reviewed release payload, excluding `.env`, SQLite, `.git`, secrets, and build artifacts. Keep existing `/opt/pakpost/.env` and Docker volumes intact. Never run EF migrations automatically.

```bash
cd /opt/pakpost
bash scripts/production/d5-deploy-vps.sh           # dry-run
bash scripts/production/d5-deploy-vps.sh --deploy # explicit confirmation, feature OFF
bash scripts/production/d5-smoke.sh
# After checking Google web login + CRUD + logs:
bash scripts/production/d5-toggle-vps.sh --enable
bash scripts/production/d5-smoke.sh
```

If the web regressions appear or auth is suspected: `bash scripts/production/d5-toggle-vps.sh --disable` and, for app rollback, `bash scripts/production/rollback.sh` (DB not rolled back).

## Browser/desktop acceptance test
1. Web Google SSO remains functional at public domain.
2. Desktop profile `PakPost Cloud` => browser login => explicit approval => connect.
3. Remote workspace lists/collections/environments + allowed CRUD work, forbidden roles denied.
4. Logout invalidates token and local collections remain unchanged.
5. Desktop auth OFF blocks previously issued desktop tokens.

**Known gaps**: source was not compiled in this environment; automatic tests for full pairing/auth security and desktop E2E are not present; realtime SignalR remains unsupported on desktop; tokens only in Rust memory; Dockerfiles were not in the source archive. Production safety depends on verifying actual deployed source and secrets. Do not consider this a certified secure production release.
