# Configuration reference

Root `.env` is consumed by Docker Compose. `backend/.env` is shell-sourced by backend scripts and must be trusted, shell-compatible `KEY='value'` assignments. `frontend/.env` supplies public Vite build configuration. They are not interchangeable. Copy the respective examples for new installations only.

## Compose variables

| Variable | Purpose / default |
| --- | --- |
| `POSTGRES_CONNECTION_STRING` | Required PostgreSQL connection string |
| `JWT_SIGNING_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE` | Signing material; issuer `pakpost`, audience `pakpost-client` |
| `WORKSPACE_MASTER_KEY`, `WORKSPACE_MASTER_KEY_ID` | Envelope encryption; ID defaults to `master-v1` |
| `ENVIRONMENT_ENCRYPTION_KEY` | Existing environment encryption material; retain across upgrades |
| `GOOGLE_CLIENT_ID` | Required public OAuth Web client ID, shared by backend and frontend build |
| `SMTP_HOST`, `SMTP_PORT` | Invitation mail, default smtp.gmail.com:587 |
| `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Required by base Compose |
| `PAKPOST_DEPLOYMENT_MODE` | `SelfHosted` (default) or `Public` |
| `DESKTOP_AUTH_ENABLED` | Enables browser-based desktop pairing; default false in Compose |
| `PAKPOST_PUBLIC_URL` | Exact browser origin and invitation base URL |
| `PAKPOST_SITE_ADDRESS`, `PAKPOST_ACME_EMAIL` | Caddy site and ACME contact |
| `PAKPOST_BIND_HOST`, `PAKPOST_HTTP_PORT`, `PAKPOST_HTTPS_PORT` | Defaults 127.0.0.1, 8080, 8443 |
| `COMPOSE_PROJECT_NAME` | Default pakpost; preserve on updates |
| `PAKPOST_DOCKER_SUBNET`, `PAKPOST_CADDY_IP` | Default 172.30.77.0/24 and 172.30.77.10; trusted forwarder |
| `ASPNETCORE_ENVIRONMENT` | Development locally; Production for public HTTPS |
| `PROXY_ALLOW_PRIVATE_NETWORKS` | Default false; do not enable for public deployments |
| `DB_CONNECT_TIMEOUT_SECONDS`, `DB_COMMAND_TIMEOUT_SECONDS` | 15, 30 |
| `DB_MAX_POOL_SIZE`, `DB_HEALTH_TIMEOUT_SECONDS` | 30, 4 |
| `REQUEST_TIMEOUT_DEFAULT_SECONDS`, `REQUEST_TIMEOUT_AUTH_SECONDS`, `REQUEST_TIMEOUT_PROXY_SECONDS` | 90, 30, 25 |
| `DB_DISABLE_GSS_ENCRYPTION` | Optional production overlay; false by default |
| `DUCKDNS_SUBDOMAIN`, `DUCKDNS_TOKEN` | Optional DuckDNS updater profile |

`COMPOSE_FILE=compose.yaml:compose.production-hardening.yaml` selects the Linux VPS overlay (colon separator on Unix). Provision its host directories before startup. The overlay sets Data Protection file/certificate paths, logging, graceful shutdown and GSS policy. Do not apply it blindly on a desktop host.

For direct backend development the mapped .NET keys use `__` separators (e.g. `ConnectionStrings__Postgres`, `Google__ClientId`, `WorkspaceEncryption__MasterKey`). See `backend/.env.example`. `VITE_GOOGLE_CLIENT_ID` is public; never put secrets in `VITE_*`. Legacy password login is disabled by Compose and should remain disabled except for a controlled migration.

## Storage and permission policy

Public mode: verified Google users may create workspaces, ten total seats. SelfHosted mode: creation requires instance administrator or Workspace Creator privilege, no configured seat cap. Workspace roles are separate from platform privileges. Desktop profiles use HTTPS for remote authentication; keep Local data separate and export only intentionally. A credential vault stores persistent desktop login when enabled; it is not a general vault for all local request content.
