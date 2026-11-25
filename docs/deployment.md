# Production deployment

This guide is for a Linux VPS with Docker Compose, a reachable PostgreSQL instance and a domain pointing to the VPS. Use a non-root deployment account with restricted access; Docker daemon access is effectively root-equivalent. Expose only Caddy (80/TCP, 443/TCP and optionally 443/UDP); do not expose backend or frontend ports directly.

## First HTTPS deployment

Follow [installation](installation.md) for database and independent keys. Replace the local values in root `.env` (example only):

```dotenv
ASPNETCORE_ENVIRONMENT=Production
PAKPOST_SITE_ADDRESS=api.example.com
PAKPOST_PUBLIC_URL=https://api.example.com
PAKPOST_BIND_HOST=0.0.0.0
PAKPOST_HTTP_PORT=80
PAKPOST_HTTPS_PORT=443
PAKPOST_ACME_EMAIL=admin@example.com
DESKTOP_AUTH_ENABLED=true
COMPOSE_FILE=compose.yaml:compose.production-hardening.yaml
DB_DISABLE_GSS_ENCRYPTION=true
```

Authorize the HTTPS origin in the Google Web client configuration. Keep proxy private-network access disabled. Configure `SelfHosted` or `Public` explicitly. Build the backend image and verify its runtime UID/GID before provisioning the persistent Data Protection directories:

```bash
docker compose build backend
docker image inspect pakpost/backend:local --format '{{.Config.User}}'
# Expected 1654:1654 for the supplied Dockerfile:
sudo bash scripts/production/provision-data-protection.sh
```

If the runtime user differs, inspect and adapt the provisioning script before running it. Back up both the certificate/private key and key ring, securely and separately from source code. This is unrelated to Caddy TLS certificates or workspace master keys. For the first database migration, follow installation review; then start the services.

```bash
docker compose config --quiet
docker compose up -d --build backend frontend caddy
curl -fsS https://api.example.com/health/live
curl -fsS https://api.example.com/health/ready
```

Caddy obtains its certificate automatically if DNS and ACME connectivity are correct. Keep Caddy's named volumes. The optional `duckdns` profile updates DNS only; configure its token privately.

## Existing instance update

Run quality checks locally. Confirm database backups and schema compatibility if migration files changed; deployment does not migrate automatically. Use a reviewed source checkout or `sync-vps.sh` (dry run by default; see script help). Keep server `.env`, key material and backups intact. Do not use `rsync --delete` on a live instance.

On VPS, from the deployed root:

```bash
bash scripts/production/preflight.sh
# If migrations changed, inspect status and review the pending SQL first:
bash scripts/production/migration-status.sh
# Apply separately only after backup and compatibility review.
PAKPOST_HEALTH_URL=https://api.example.com/health/ready \
  bash scripts/production/deploy.sh
```

Set `PAKPOST_RECREATE_CADDY=1` for changed Caddy configuration that requires recreation. The script saves previous app image tags, validates Caddy config, builds/recreates services and probes liveness, readiness and frontend. Brief downtime and WebSocket reconnects are possible; this is not blue/green deployment. The health URL must match your actual public origin (the script retains the original instance as its default).

```bash
docker compose ps
docker compose logs --since=2m backend caddy
docker stats --no-stream
```

Manually verify sign-in, role permissions, workspace access, invitation/member removal, native pairing and realtime sync. Never share raw logs containing tokens. The production overlay uses Docker local logging with 10m × 3 per service and reduces EF/ASP.NET noise. Caddy redacts structured request headers/URI; historical log files are not automatically sanitized.

## Rollback

`bash scripts/production/rollback.sh` asks for confirmation and restores the previous backend/frontend image tags. It does not restore database schema, source/config files, Caddy version or encryption keys. Verify compatibility and separately restore configuration if necessary. Do not prune backup images until acceptance is complete. See [backup and recovery](backup-and-recovery.md).
