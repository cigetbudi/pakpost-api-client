# Phase 11 — Cloud request index + lazy detail

This change separates Explorer browsing from editing/exporting full encrypted requests. It builds on the Phase 11 collection listing and bulk delete optimization.

## What changed

| Endpoint | Purpose | Sensitive fields read/decrypted |
| --- | --- | --- |
| `GET /api/workspaces/{workspaceId}/collections/{collectionId}/requests/index` | Lightweight Explorer index | URL and HeadersJson only, because search, documentation and response-example disclosure still require them |
| `GET /api/workspaces/{workspaceId}/collections/{collectionId}/requests/{requestId}` | Open one complete request | All existing encrypted request fields for that request |
| `GET /api/workspaces/{workspaceId}/collections/{collectionId}/requests` | Legacy full collection read | Full payload; retained for export, collection runner, duplication and edit workflows |
| `GET /api/workspaces/{workspaceId}/collections/{collectionId}/requests/{requestId}/history` | Revision list | Revision metadata only; no snapshot fetch/decryption |

`/requests/index` returns `id`, `collectionId`, `folderId`, `revision`, `name`, `method`, `url`, `headersJson`, and `isIndex: true`. It intentionally excludes `body`, `bodyMode`, `contentType`, `formFieldsJson`, `preRequestScript`, and `postResponseScript`. Frontend components **must not pass index objects to a save endpoint**. Rename fetches the current full record first. Browser tabs hydrate via the detail endpoint; existing open editor drafts are preserved.

All read paths verify authenticated Workspace permissions and Collection membership before reading request metadata. The detail route additionally restricts the database lookup to the requested Collection. Stored headers retain the existing legacy-credential redaction policy. The Workspace encryption scheme and DEK scoping are unchanged. No migration, key rotation, Redis or database writes are introduced.

## Expected effect and trade-offs

- Opening/expanding Cloud Collections transfers less data and avoids fetching/decrypting potentially large request bodies, form fields and scripts for every row.
- Version-list views avoid loading encrypted historical snapshots. Selecting an individual historical revision still decrypts that one revision.
- Opening a previously unopened request or response example adds **one** detail API request. Poor network latency may make the first click take slightly longer; repeated clicks on an already-open tab reuse the existing draft.
- URL and HeadersJson are deliberately kept in the index for backward-compatible search, response examples and documentation. Collections with exceptionally large response examples may still return sizable index responses. A later phase could separate example summaries into their own representation.
- Export, runner and duplication still use the existing full-list API, so their initial fetch cost is unchanged. No caching of unwrapped Workspace keys across EF DbContext scopes was added.
- This is a targeted architectural optimization, **not** a benchmarked speedup claim.

## Verifications

Run `./backend/scripts/verify-refactor.sh` and `./backend/scripts/verify-postgres-integration.sh` **only with the configured disposable integration database**. Frontend: `cd frontend && bun run quality:check`.

Browser smoke paths: open Cloud Collection, open request, open response example, rename an existing request, Save, duplicate, export and runner; test versions and a second user's Workspace permissions. Verify that response examples, bodies, scripts and documentation still match their previous saved values. Check that opened Cloud editor tabs with unsaved changes are not overwritten by network fetches.

Rollback: reverse the patch against the Phase 11 baseline. There is no schema or persisted data change.
