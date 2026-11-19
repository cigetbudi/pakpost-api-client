# Phase 8 — Workspace encryption and browser cache audit

This is a source-level audit of the reconstructed PakPost baseline through
Interceptor v0.2.0 plus the Phase 8/9 changes. It is **not** a penetration test,
and the new rotation command has **not** been run against PostgreSQL in this
artifact-building environment.

## Existing encrypted persistence coverage

The EF Core interception points are
`PakpostDbContext.Encryption.cs` (`StageSensitiveFieldsAsync`) and
`PakpostDbContext.Decryption.cs` (authorized repository read paths):

| Record | Workspace DEK-protected fields | Checked |
| --- | --- | --- |
| `SavedRequest` | `Url`, `HeadersJson`, `Body`, `FormFieldsJson`, `PreRequestScript`, `PostResponseScript` | Encrypt/decrypt paths match |
| `Collection` | `VariablesJson` | Encrypt/decrypt paths match |
| `RequestEnvironmentVariable` | `StoredValue` | Encrypt/decrypt paths match |
| `SavedRequestRevision` | `EncryptedSnapshot` | Encrypt/decrypt paths match |

The key table `organization.workspace_encryption_keys` stores only a wrapped
DEK and a `master_key_id`. Migration `20261118220000_WorkspaceEnvelopeEncryption`
continues to apply only to a database with no preexisting Workspaces.

**Still plaintext by design:** user/workspace/collection names, HTTP method,
identifiers, folder structure, roles, timestamps, variable keys/flags and other
indexing/authorization metadata. Access-authorized API responses and local
request execution also contain plaintext while used by the client.

## Security boundaries verified in this patch

- A workspace with a `master_key_id` different from the configured current ID
  fails closed during DEK resolution; no fallback to a different key.
- Offline rotation authenticates all original wrappers, produces/validates the
  replacement wrappers and modifies them in a single serializable transaction.
- Both browser recovery keys remove Cloud request tabs and drafts for **all**
  roles. Existing legacy copies are scrubbed on read.
- Workspace collection documentation no longer persists to `localStorage`;
  old entries migrate to session storage and are cleared on logout.
- Interceptor's Allow All controls *destinations only*, while approved PakPost
  caller-origin validation stays in the background script.

## Open follow-ups / threat model exclusions

1. `sessionStorage` remains plaintext and can survive tab/browser restoration.
   Local tester drafts can intentionally contain secrets. Workspace collection
   documentation is still a session-local sidecar; move it to the encrypted
   backend before promising durable, securely synchronized documentation.
2. Workspace encryption is not E2EE. A compromised backend process holding the
   Master Key, or a compromised browser, can read authorized plaintext. Secrets
   in scripts/headers can also enter third-party endpoints via user actions.
3. All writes must go through EF Core's guarded `SaveChangesAsync` and repository
   decryption helpers. Direct SQL writes, `ExecuteUpdate`, and direct reads of
   sensitive entities bypass these conventions. Add tests for every new path.
4. `EnvironmentEncryption__Key` is a separate legacy encryption dependency;
   Phase 8 rotation intentionally **does not rotate** it. Back it up separately.
5. The rotation CLI needs `dotnet build` and disposable-PostgreSQL integration
   test execution before production approval. Unit tests cover wrong-key,
   wrong-workspace, ID mismatch and field ciphertext compatibility; SQL atomicity
   is not verified by the Node test suite.
6. An extension installed unpacked or temporarily cannot silently auto-update;
   the v0.3.0 packages are unsigned release artifacts. Official signing/store
   publication or enterprise extension management is a separate operational step.

## Verification checklist

```bash
./backend/scripts/verify-refactor.sh
./backend/scripts/verify-postgres-integration.sh   # disposable integration DB only
node frontend/scripts/check-source-imports.mjs
node --test frontend/tests/*/*.test.js
bash extension/release.sh
cd extension/releases && sha256sum -c SHA256SUMS
```

Before using real production Workspace data, separately test key rotation on a
**database clone**, verify backward access after rotation, confirm rollback by
running the CLI in reverse, and review any logging/telemetry configuration that
may capture decrypted values.
