# Pakpost — Full-stack MVP (No-login HTTP Tester + Private Workspaces)

A **fresh, independent** Pakpost application to try from zero. It is **NOT** a drop-in patch to your earlier `pakpost-starter`. Keep the earlier project as backup.

## Actual access policy

| Feature | Guest | Authenticated user |
|---|---:|---:|
| Open the UI | Yes | Yes |
| Execute outbound public HTTP requests | Yes | Yes |
| Response body / headers / status / duration | Yes | Yes |
| Session-only request history | Yes | Yes |
| Register / sign in with email + password | Yes | Yes |
| Workspace create and list | **401** | Yes |
| Workspace member invitation-by-email (existing account) and assigned roles | **401** | Yes with authorization |
| Team create / view / add workspace members | **401** | Yes with authorization |
| Collections / save / load / delete saved requests | **401** | Yes with authorization |

Google SSO is **not** configured yet. Local email/password is an interim MVP identity system so that workspace and collection permissions can actually be exercised. No fake login / dev authentication bypass is used.

## Requirements

- .NET SDK 10 (`dotnet --version`)
- Node.js 22+ and npm
- **New empty Neon PostgreSQL database**, or an entirely fresh database inside a separate Neon branch (a branch copied from an existing branch is not necessarily empty)
- An outbound internet connection for NuGet, npm, and requests to the tested APIs

## 1. Create a new folder from this ZIP

Extract ZIP as `pakpost-fullstack-mvp/`, **do not** overwrite existing project folders. This archive contains both a `backend` and `frontend`. Configure and run the new app separately before deciding whether to adopt it.

```bash
cd pakpost-fullstack-mvp
cp backend/.env.example backend/.env
openssl rand -base64 48
nano backend/.env
```

Edit at minimum:

```dotenv
ConnectionStrings__Postgres='Host=YOUR_NEON_HOST;Port=5432;Database=neondb;Username=YOUR_USER;Password=YOUR_PASSWORD;SSL Mode=Require'
Jwt__SigningKey='PASTE_THE_RANDOM_GENERATED_SECRET_HERE'
```

Connection string must target a **new empty Neon database**, not the previous Pakpost schema with failed migrations. `.env` is shell-compatible and loaded via a trusted bash `source`; keep it private and never commit.

## 2. Build the DDD backend and create the initial EF migration

```bash
cd backend
dotnet restore Pakpost.slnx
dotnet build Pakpost.slnx
./scripts/init.sh
```

`init.sh` creates `InitialCreate` in **Infrastructure/Persistence/Migrations** and a generated SQL preview `backend/artifacts/initial.sql`. It **does not** alter the database by itself.

```bash
sed -n '1,200p' artifacts/initial.sql
```

Verify the SQL starts with required schema creation (`auth`, `organization`, `collection`) and all required tables, and has no unexpected destructive operations.

## 3. Apply to your new empty Neon database

```bash
./scripts/apply-migrations.sh --apply
```

**Never run this against the old DB until you have confirmed its state and created a backup.** Migration doesn't reset a database automatically. Creating a new Neon branch of the old one may copy old tables and migrations, so use a truly empty DB.

## 4. Start the API

Terminal A (still in `backend/`):

```bash
./scripts/run.sh
```

API: `http://127.0.0.1:5080`  
Check: `curl -i http://127.0.0.1:5080/health`

## 5. Start the frontend

Terminal B:

```bash
cd pakpost-fullstack-mvp/frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173` (or `http://localhost:5173`). Vite forwards `/api` to the backend, so you can send requests without changing API CORS settings. If using different ports/domains, update `frontend/vite.config.js` and CORS allowed origins as appropriate.

The UI opens directly into the public API Tester. Try `GET https://httpbin.org/get`, optionally add headers and a raw JSON body for POST. Click **Send**, inspect status / response. No login required.

## 6. Exercise private workspaces & teams

1. Click **Sign in / Create account** and create a new account (password at least 12 characters).
2. Select **Workspaces** and create a workspace.
3. Create a collection under the workspace.
4. Return to **API Tester**, enter a request, click **Save to collection**.
5. Return to the collection to load the request into the tester again.
6. To test member/team membership with multiple accounts, register a second account in another browser session, add it to the workspace by email, then add it to a team.

Useful API checks (without a token):

```bash
curl -i http://127.0.0.1:5080/api/workspaces
# -> HTTP 401
curl -i -H 'Content-Type: application/json' -d '{"method":"GET","url":"https://httpbin.org/get","headers":{},"body":""}' http://127.0.0.1:5080/api/proxy/send
# -> API target response fields (statusCode, headers, body, elapsedMs), assuming internet connectivity
```

## 7. Smoke test anonymous vs private boundaries

With the API still running:

```bash
cd backend
./tests/smoke.sh
```

The smoke script checks health, ensures unauthenticated `/api/workspaces` responds with HTTP 401, and attempts to send an anonymous request to httpbin.org.

## Backend architecture (Clean Architecture / DDD-style / CQRS)

```text
backend/
├── Pakpost.slnx
├── src/
│   ├── Pakpost.Api/             # Controllers, JWT, HTTP pipeline, error handling
│   ├── Pakpost.Application/     # MediatR commands/queries, validators, interfaces
│   ├── Pakpost.Domain/          # Entities, enums, business rules
│   └── Pakpost.Infrastructure/  # Npgsql EF Core, repositories, PBKDF2, JWT, safe HTTP proxy
├── scripts/
│   ├── init.sh
│   ├── apply-migrations.sh
│   └── run.sh
└── .config/dotnet-tools.json    # Local EF CLI (run from backend/ or scripts)
```

Neon tables reside in `auth`, `organization` and `collection` schemas. `InitialCreate` is generated **once** from this new model. Later incremental migrations go into the same Infrastructure migrations folder. Do not copy `SyncPakpostModel` or the old snapshot into this new backend.

## Important public proxy security

`POST /api/proxy/send` intentionally does not require authentication. To avoid creating an unsafe open network proxy, the MVP includes:

- HTTP(S) only; no URL embedded credentials; redirects NOT followed
- DNS resolution pinned to a vetted IP for the connection; default blocking of loopback, private, link-local and several reserved addresses
- Port allowlist (80 and 443), 15-second timeout, 128 KB request body, 1 MB response cap
- 30 requests per minute per remote IP; 10 authentication attempts per minute per IP
- No server-side cookies reused or forward proxies used

**This is a development MVP, not a production-grade public proxy.** For internet deployment, add server-wide egress restrictions, distributed throttling, abuse protection, metrics, secure hosting, target rules and an external security review. Never set `Proxy__AllowPrivateNetworks=true` in a remotely reachable environment. The local development option allows tests of local targets **only** when explicitly enabled in Development and with their port explicitly listed (e.g. add `Proxy__AllowedPorts__2='8000'`).

**Sensitive data caution:** this prototype stores saved request headers and bodies as plain database data. Do not save real production tokens / PII / secrets until vault, masking and access controls have been hardened. The app temporarily holds JWT in browser `sessionStorage`; production should revisit token/session storage policy and add email verification, password reset, audit logs and Google SSO.

## Out of scope for this starter

Pre-request and post-request JavaScript scripting, variables/environment manager, external Google SSO, invitation-by-email, superadmin management panel, desktop Tauri, RBAC granularity, and production deployment are **not built yet**. This is intended to validate the anonymous-send / authenticated-save user flow first.

## Known verification limitation

This ZIP has been checked for file structure and JSX syntax, but the packaging environment lacked the .NET SDK and could not complete npm dependency installation. Actual `dotnet build`, EF SQL generation, Neon migration, and `npm run build` must be run on your machine; please report compiler or migration messages if they appear.
