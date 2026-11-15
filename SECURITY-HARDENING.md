# Pakpost — Security hardening phase 1

Based on `pakpost-source-audit.zip` (15 Nov 2026), with frontend structure matching v21. This is a security-focused incremental patch, **not** a certification, NuGet CVE scan, production penetration test, or migration to Mediator/Bun. No schema migration required.

## Behavioral changes (read before applying)

1. **Workspace environment secrets:** Owner/Admin can read and edit values as before; Member can list environment names/nonsecret variables, but secret variables return `{ value: "", isSecret: true, isRedacted: true }`. The frontend refuses to interpolate redacted variables. Members relying on secrets owned by the workspace will need Owner/Admin assistance or an approved server-side secret-use flow in a future phase. **All real secrets accessible to Owner/Admin are still delivered to their browser**; those users and any permitted browser script can extract them. This is not a zero-knowledge vault.
2. **Workspace collection permissions:** all members may read collections, create collections, create saved requests, and edit saved requests (collaboration retained). Only Owner/Admin may rename/delete collections, delete saved requests, or move saved requests between collections. These endpoints now return 403 for Member.
3. **Sensitive saved headers:** create/update refuses literal `Authorization`, `Cookie`, `X-API-Key`, `X-Auth-Token`, etc.; use header values such as `Bearer {{token}}` or `{{apiKey}}`. Disabled sensitive rows are checked too because they are saved to JSONB. Legacy values under sensitive header names are blanked in API responses; the original stored values **still exist in the database**, backups and any prior exports/caches. This check does **not** scan script bodies, payload bodies, custom query parameters, or all possible nonstandard header names. Do not place tokens there.
4. **Public HTTP proxy:** per-instance concurrency defaults to 8 simultaneous proxy sends (override with `Proxy__MaxConcurrentRequests`, range 1–64); extra concurrent sends return HTTP 429 without queueing. Preexisting per-IP rate limiting and DNS pinning remain. IPv6 6to4/Teredo and non-global IPv6 ranges are blocked. Upload transport cap becomes 7,500,000 bytes to accommodate an encoded 5 MiB file; response/body checks remain. This is **not** distributed/global across replicas. An ingress/network egress policy is still required before exposing the proxy widely.
5. **No-store response headers:** workspace and auth API responses now send `Cache-Control: no-store, private`, but this does not prevent code in the frontend from using browser storage and does not erase already-cached drafts.

## Installation

From the Pakpost repository root after backing up/committing your current work:

```bash
unzip pakpost-security-phase1.zip
# Inspect first (no database operations occur):
git apply --check pakpost-security-phase1/pakpost-security-phase1.patch
git apply pakpost-security-phase1/pakpost-security-phase1.patch
```

If your local code has diverged since the uploaded audit ZIP, **do not use `git apply --3way` or force the patch**. Reconcile changed files first.

## Build and regression checks

```bash
cd backend
# No migration needed. Use the same approved NuGet versions as your audited .NET 10 branch.
dotnet restore Pakpost.slnx
dotnet build Pakpost.slnx
bash tests/run-security-checks.sh
# Optional: verify all projects still have no known vulnerable transitive dependencies
dotnet list Pakpost.slnx package --vulnerable --include-transitive
cd ../frontend
npm test
npm run build
```

### Smoke tests with a disposable workspace

- Guest `POST /api/proxy/send` to an approved public HTTP endpoint should still work; loopback/private addresses must remain blocked in production.
- Owner/Admin vs Member environment GET: Member receives `isRedacted: true` and no secret value; Owner/Admin still see the value.
- Member receives 403 for rename/delete collection, delete/move saved request. Member can create/edit request if permitted by the product collaboration policy.
- Save `Authorization: Bearer actual-token` returns 400; `Authorization: Bearer {{token}}` saves.
- Load a **throwaway** older saved request with a literal sensitive header and verify the API masks it; don't test using real credentials.
- Flood testing and SSRF testing should only be done on a staging/development deployment you control.

## Data that needs operator review

- **Rotate any real credential** previously saved in cleartext headers, code scripts, URLs or request bodies. Review Neon data, backups, old ZIP archives, and browser caches. This patch intentionally does not run destructive SQL or automatically erase historical data.
- Local browser secret/token storage is still a risk under XSS; strict CSP and an eventual HttpOnly session architecture should be designed separately and tested with QuickJS/Vite constraints.
- Saved request scripts and raw bodies are still plain text. A complete safe-secrets implementation requires a separate data model and explicit runtime permissions.
- Per-IP rate limiting depends on the real trusted client IP and should be configured correctly behind ingress; do not trust arbitrary forwarded headers.
- Proxy HTTPS outbound still creates a fresh handler for security-conscious DNS/IP pinning. Pooling requires a separate benchmark and SSRF safety review.
- Workspaces/teams need more full integration tests, including tenant isolation, before production use.

## Rollback

If this patch was applied cleanly and has not been mixed with further edits:

```bash
git apply --reverse --check pakpost-security-phase1/pakpost-security-phase1.patch
git apply --reverse pakpost-security-phase1/pakpost-security-phase1.patch
```

Rollback does not restore any credentials or database records; this phase does not run migrations or modify existing stored records automatically.
