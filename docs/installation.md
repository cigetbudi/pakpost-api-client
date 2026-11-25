# Installation

## Choose the deployment

For offline/local desktop use, follow [desktop](desktop.md); no PakPost server account is required. For shared workspaces, use the server stack below. PostgreSQL is external to Compose (Neon or your own compatible PostgreSQL server). Compose starts backend, frontend and Caddy, not a database.

### Requirements

Docker Engine with Compose v2, OpenSSL, curl, a reachable PostgreSQL database, Google OAuth **Web application** client ID, and an SMTP account for invitation mail. A fresh isolated database is recommended. For development see [development](development.md).

### Configure an instance

From the repository root, copy `.env.example` to `.env` only if it does not exist. Restrict access (`chmod 600 .env`). Set `POSTGRES_CONNECTION_STRING` to the intended database, `GOOGLE_CLIENT_ID`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and the three independent keys. Generate each secret separately on the host:

```bash
openssl rand -base64 48 # JWT_SIGNING_KEY
openssl rand -base64 32 # WORKSPACE_MASTER_KEY
openssl rand -base64 32 # ENVIRONMENT_ENCRYPTION_KEY
```

Do not regenerate keys for an existing installation. Keep the actual values out of Git, screenshots, logs and command history. Use a verified TLS connection to remote PostgreSQL, with CA validation appropriate to the provider. See [configuration](configuration.md).

In Google Cloud, authorize `http://localhost:8080` as a JavaScript origin for the Web client ID. For production use the exact HTTPS origin instead. The frontend embeds the public client ID during the build; the backend must use the same ID. Google Identity Services ID-token login does not require a client secret in Vite.

### Initialize the database

Check the target and back up any existing data. EF migrations are already included; do not generate a new InitialCreate.

```bash
docker compose config --quiet
docker compose --profile migration build migration
docker compose --profile migration run --rm migration migrations list \
  --project src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj \
  --startup-project src/Pakpost.Api/Pakpost.Api.csproj --context PakpostDbContext
```

Review the pending migration source and generated SQL before applying. For a new database, use `migrations script 0` with the same project/startup/context arguments to inspect SQL; for an existing database use the last applied migration as the starting point. Do not automatically execute an idempotent script containing concurrent indexes inside a transaction. For example, on a new database, save the migration SQL for inspection:

```bash
mkdir -p backend/artifacts
docker compose --profile migration run --rm -T migration migrations script 0 \
  --project src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj \
  --startup-project src/Pakpost.Api/Pakpost.Api.csproj --context PakpostDbContext \
  > backend/artifacts/migrations-review.sql
```

Keep generated SQL private and review command output before executing anything.

```bash
# Explicit migration step, only after target and SQL review:
docker compose --profile migration run --rm migration
docker compose up -d --build backend frontend caddy
curl -fsS http://localhost:8080/health/live
curl -fsS http://localhost:8080/health/ready
```

Open http://localhost:8080. Default Compose binds Caddy to loopback. Sign in with Google to create a user. The default SelfHosted policy requires an administrator grant to create a workspace. See below.

### First instance administrator (SelfHosted)

The source has no public administrator bootstrap endpoint. After the intended administrator has signed in, the database operator must verify the account identity and grant `auth.users.IsSuperAdmin` through a controlled, audited database operation. Do not grant by an unverified email or expose this operation as a public endpoint. Check exactly one intended user row, use its UUID, and confirm the change in a transaction. Then use Platform Administration to grant workspace creator access or issue a creator invitation. Public mode allows verified Google identities to create workspaces with ten total seats each.

### Production

Do not expose the local HTTP setup to the internet. Use [deployment](deployment.md) for HTTPS, provisioned Data Protection keys, log rotation and safe deployment. Keep the PostgreSQL service private. Do not use `docker compose down -v` for routine updates.
