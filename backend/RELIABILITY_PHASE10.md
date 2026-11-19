# PakPost Phase 10 — Reliability without Jaeger

This phase does not install OpenTelemetry, Jaeger, Redis or a new database migration.

## Endpoint contract

| Endpoint | Authentication | Normal response | Failure response |
| --- | --- | --- | --- |
| `GET /health` | Public | Legacy `{ "status": "ok", "service": "pakpost-api", "mode": "anonymous-tester-with-private-workspaces" }` | API unavailable |
| `GET /health/live` | Public | `200 {"status":"healthy"}` | API unavailable |
| `GET /health/ready` | Public | `200 {"status":"healthy"}` | `503 {"status":"unavailable"}` |
| `GET /api/system/health` | JWT | `200`, backend/database status, probe duration | `503` with minimal database status; `401` without token |

The detailed endpoint is accessible to signed-in users, **not just platform super-admins**. No database host, credentials, SQL, connection string, workspace data, or exception detail is sent to clients. Public endpoints omit latency and internals. The readiness probe executes `SELECT 1` and verifies connectivity, **not schema migration completeness**.

Readiness and authenticated health-detail requests are rate-limited (60 requests/minute/IP) to avoid unnecessary PostgreSQL work. The Settings **System Health** view refreshes every 30 seconds while mounted. Anonymous visitors see API and database availability; latency is only requested when logged in.

## Correlation and logs

- Every request receives `X-Request-ID`. Safe client-supplied identifiers (1–64 ASCII letters, digits, dots, hyphens or underscores) are preserved; unsafe values are replaced.
- Structured JSON logs are sent to standard output. Include timestamp, request ID scope, route template, method, HTTP status and elapsed milliseconds.
- Only **route templates** are logged, not user-supplied URLs, query strings, cookies, headers, request bodies, response bodies, or API secrets.
- Exclude `/health*` from access logs to avoid flooding. Other framework/Npgsql loggers may have their own settings.
- HTTP errors continue returning the existing `message`/`errors` contract. HTTP 503 for temporary database failures carries `Retry-After: 3` only on GET/HEAD (writes are **never** transparently retried); HTTP 409 for transaction conflicts remains unchanged. `httpClient.js` attaches `error.requestId` and `error.retryAfter` when the response includes those headers.

## Timeouts and connection handling

Set optional environment variables in `backend/.env`:

```dotenv
Database__ConnectTimeoutSeconds='15'
Database__CommandTimeoutSeconds='30'
Database__MaxPoolSize='30'
Database__HealthTimeoutSeconds='4'
RequestTimeout__DefaultSeconds='90'
RequestTimeout__AuthSeconds='30'
RequestTimeout__ProxySeconds='25'
```

The Npgsql connection string retains the existing SSL configuration and is never logged. PostgreSQL connection and command timeouts are bounded; the pool is capped. **No `EnableRetryOnFailure` is applied globally** because EF Core writes and user-managed Serializable transactions must not be replayed without an explicit, idempotent execution strategy. The health probe alone may retry a failed connection once after 150 ms; this is a read-only check. Request timeout responses use the built-in ASP.NET Core request-timeout middleware and return sanitized JSON HTTP 504; endpoints should honor cancellation tokens. SignalR Hub endpoints explicitly **disable** the default request timeout to avoid terminating long-lived WebSocket connections.

## Smoke tests

Start PakPost with the existing `backend/.env` and `./scripts/run.sh`.

```bash
curl -i http://127.0.0.1:5080/health/live
curl -i http://127.0.0.1:5080/health/ready
curl -i -H 'X-Request-ID: support-check-01' http://127.0.0.1:5080/health/live
curl -i http://127.0.0.1:5080/api/system/health # Must be 401 without JWT
```

In DevTools > Settings > System Health, verify that the availability checks render correctly while signed in and out. With PostgreSQL unavailable, liveness should remain 200, readiness should become 503, and DB-dependent requests should return a sanitized 503 where the underlying exception is classified as transient. Do not disconnect a live production database solely to exercise this failure path.

```bash
./backend/scripts/verify-refactor.sh
cd frontend && bun run quality:check
```

`verify-postgres-integration.sh` is for a **disposable PostgreSQL test database only**, never production NeonDB. This phase does not apply migrations or rotate encryption keys.
