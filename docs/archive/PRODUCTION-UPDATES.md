# PakPost — safe VPS update workflow

**Target:** existing `/opt/pakpost`, Neon PostgreSQL, `pakpost.duckdns.org`, Compose services `backend`, `frontend`, `caddy`, and optional migration profile. Do **not** replace server `.env` during `rsync`.

## First installation of these scripts

Copy `scripts/production/` from this patch into your checkout, commit it, then sync it to `/opt/pakpost`. Add `.pakpost-last-backup*` to the **existing** `.gitignore`.

## For every web release

1. On PC: run frontend quality checks and backend tests; review changes to `frontend`, `backend`, `compose.yaml`, `docker/` and EF migrations.
2. Before DB changes: make a Neon restore point/branch or backup, and **verify the target database**; deploy backward-compatible additive migrations first where possible.
3. Sync with `rsync` excluding `.env`, `.git`, `node_modules`, build output, and `.pakpost-last-backup*`; never use `--delete` on VPS before confirming target.
4. VPS: `cd /opt/pakpost && ./scripts/production/preflight.sh`.
5. If migrations changed: `./scripts/production/migration-status.sh`; generate/review SQL, then run `docker compose --profile migration run --rm migration database update --project src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj --startup-project src/Pakpost.Api/Pakpost.Api.csproj --context PakpostDbContext` **only after database backup and compatibility review**. A migration may not be reversible, including `CREATE INDEX CONCURRENTLY` partial failures. Use Neon direct connection for migration rather than pooled endpoint when possible.
6. VPS: `./scripts/production/deploy.sh` — saves previous images, rebuilds only app images, `up -d`, then probes public `/health/ready`.
7. Smoke test Google sign-in, collection CRUD, request execution, SignalR/realtime, and secrets access.
8. If **app-only** regression and old app understands new DB schema: `./scripts/production/rollback.sh`. This restores old images, **not** database. On destructive DB changes, restore Neon data separately under a tested recovery plan; never blindly downgrade schema.

**Important:** The script does not claim zero downtime. On a single VPS `docker compose up -d` recreates containers and may briefly interrupt requests or WebSocket connections. Zero-downtime deploy requires a blue/green or dual-service approach with a switchable proxy and DB compatibility. Container health probe alone is not enough for release acceptance.

The script uses the public URL for health checks; set `PAKPOST_HEALTH_URL=https://your-domain/health/ready` in the shell if needed. Do not put login credentials in logs or commands. Expose only Caddy on ports 80/443. Docker daemon group grants root-equivalent access.

## Optional future GitHub Actions

Use GitHub Actions to test and build images; deploy via SSH using narrowly scoped credentials only after secret scanning, protected release approvals, and immutable image tags. Do **not** copy Neon keys into images, workflows, artifacts, or logs. A production host can also pull versioned images from GHCR. Keep desktop release automation separate from server deployment.
