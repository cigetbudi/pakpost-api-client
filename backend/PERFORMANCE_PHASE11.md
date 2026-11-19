# Phase 11 — Low-risk database optimizations

This patch changes query execution, not API payloads, PostgreSQL schema, encryption settings, or Workspace permissions.

## Read path

`GET /api/workspaces/{workspaceId}/collections` now asks the repository for a single, read-only projection of the collection's ID, Workspace ID, name, and saved-request count. EF Core translates the count into a correlated SQL subquery using the existing `saved_requests.collection_id` index. The previous implementation retrieved entire collections (including encrypted `VariablesJson`), unwrapped the Workspace DEK to decrypt them, and issued a second count query. API DTOs are unchanged.

Collection membership checks in Saved Requests and Cloud Folder operations now use a predicate matching **both** the collection ID and Workspace ID. That avoids materializing/decrypting collection variables for checks that only need to verify ownership. Workspace permissions are evaluated first, as before.

## Bulk deletion

`POST /api/workspaces/{workspaceId}/collections/{collectionId}/folders/delete-items` keeps the existing serializable transaction and optimistic folder-version validation. It now validates explicit request IDs using a count query, then executes a set-based `DELETE` scoped to the collection and the selected request IDs/descendant folder IDs. Previously it loaded/decrypted every request in the collection and tracked each matching entity for removal. This is particularly costly for large encrypted bodies and scripts.

`ExecuteDeleteAsync` executes immediately **inside** the existing transaction. The subsequent folder removals use `SaveChangesAsync`, followed by the same transaction commit. If `SaveChangesAsync` fails, disposal rolls back the database DELETE too. No bypass of Workspace authorization is introduced, and a request from another collection cannot be removed by supplying its ID.

## Connection pooling

The Phase 10 provider already uses **Npgsql's ADO.NET connection pool** (enabled by default) and bounds connection timeout, command timeout, and maximum pool size via `Database:*` configuration. This patch intentionally does **not** enable EF `AddDbContextPool` because `PakpostDbContext` holds per-scope decrypted DEKs and entity/workspace caches. Reusing that context without proving all sensitive state is reset is not an acceptable performance trade-off. It also avoids increasing NeonDB connection counts arbitrarily. No automatic retry of database writes was added.

## Remaining performance opportunities

`GET /api/workspaces/{workspaceId}/collections/{collectionId}/requests` still returns full request data (including body, headers, and scripts), because the web workbench, export, examples, and rename flows currently rely on that response contract. Changing it to lazy detail loading requires coordinated frontend changes and authorization tests and is **not** included here.

## Validation

- Node regression tests include structural checks for the set-based deletion and collection-scope predicate.
- .NET unit tests cover metadata projection and stale explicit selections.
- Disposable PostgreSQL integration tests cover EF query translation, count accuracy, deletion scope, and transaction rollback.
- Run .NET tests with the repository's existing test scripts, using the **disposable integration database** for PostgreSQL integration tests. Never aim `PAKPOST_TEST_POSTGRES` at production.

No migration is required.
