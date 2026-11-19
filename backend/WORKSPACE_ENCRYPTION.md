# Workspace encryption

PakPost uses server-side envelope encryption. It is **not** end-to-end encryption:
backend processes with the master key can decrypt authorized Workspace data.

## Before running the API

Generate a master key once, on your own machine:

```bash
openssl rand -base64 32
```

Put the output in `backend/.env` (or a production secret manager):

```dotenv
WorkspaceEncryption__MasterKey='BASE64_OUTPUT_FROM_OPENSSL'
```

**Do not commit or rotate this value casually.** Back it up separately from
PostgreSQL. Without it, the encrypted Workspace DEKs and data cannot be opened.
The app validates the key during startup.

Keep the existing `EnvironmentEncryption__Key` unchanged. It is still used by
legacy environment-secret and request-history encryption; Workspace encryption
wraps their ciphertext with the Workspace DEK.

## Migrations and empty-workspace guard

Apply `20261118220000_WorkspaceEnvelopeEncryption` using your normal EF migration
workflow. The migration creates `organization.workspace_encryption_keys` and
widens the request URL column to `text` because encrypted values expand in size.

The migration **refuses to run while any Workspace exists**. It does not
silently encrypt, discard, or reinterpret existing Workspace data. This is
suitable for the current empty-Workspace development baseline only.

When a Founder creates a Workspace, EF creates a fresh 256-bit DEK and stores
only its encrypted form in the new table, within the same `SaveChangesAsync`.
Deleting a Workspace cascades to its wrapped DEK.

## Fields protected

| Model | Encrypted fields |
| --- | --- |
| SavedRequest | Url, HeadersJson, Body, FormFieldsJson, PreRequestScript, PostResponseScript |
| Collection | VariablesJson |
| RequestEnvironmentVariable | StoredValue (including non-secret values) |
| SavedRequestRevision | EncryptedSnapshot (already encrypted by the legacy cipher) |

Metadata required for listing, indexing, ownership, and concurrency stays
plaintext: IDs, names, HTTP method, timestamps, roles, revisions, and the
flags/keys of environment variables. The backend decrypts after application
authorization checks. PostgreSQL stores ciphertext with `w1:` version markers;
JSONB fields store an encrypted JSON **string**, not a JSON object. Never query
those JSONB fields as structured JSON on the database side.

Decryption is bound to the Workspace ID, entity type, record ID, and field name
using AES-256-GCM authenticated additional data (AAD). Ciphertexts cannot be
silently moved between records or Workspaces.

There is no Redis dependency. The plaintext DEK is cached **only for the
lifetime of one scoped DbContext**, and zeroed when that context is disposed.

## Verification

First run the ordinary project regression suite:

```bash
./backend/scripts/verify-refactor.sh
```

Then, on a **new, disposable** database named `pakpost_integration_*`, add
`WorkspaceEncryption__MasterKey` to `backend/.env.integration`, run the
migration integration suite, and inspect the new encryption test:

```bash
./backend/scripts/verify-postgres-integration.sh
```

The integration test checks raw database values start with `w1:` while repository
reads return the expected originals. It also tests existing concurrency,
rollback, and Founder delete behavior.

## Operational limits

- There is no automatic master-key rotation, DEK rotation, or recovery workflow
  in this version. Keep a safe backup of the current master key.
- This protects PostgreSQL and database-backup contents, not a compromised API
  process that can access the master key, or plaintext in authorized API
  responses, scripts, logs, and browser memory.
- SQL `ExecuteUpdate`, direct EF `DbSet` reads of sensitive models, and direct
  SQL writes **bypass repository decrypt/encrypt conventions**. Do not add
  those paths for encrypted fields. Save through `IUnitOfWork` only.
- A tampered or missing encrypted field fails closed. No plaintext fallback
  is permitted.

## Offline master-key rotation (Phase 8)

**This is a maintenance operation, not an HTTP API and not a background task.**
The same 32-byte Workspace DEK stays in use; only its encrypted wrapper changes.
Existing `w1:` request/variable ciphertext is not rewritten, and no database schema
migration is necessary. `EnvironmentEncryption__Key` is **not** rotated by this tool.

1. Stop **every** PakPost API instance and background worker that can create or
   modify Workspaces. Disable new requests and back up the database and the
   **current** Master Key to separate secure locations. Prepare the new 32-byte
   Base64 master key in your secret manager *before* proceeding.
2. Count Workspaces and confirm the actual database name. Do not test on live
   data first. Test the complete rotation on a disposable copy of the database.
3. From a shell, enter the two base64 keys without putting them in shell history:

   ```bash
   cd ~/riset/pakpost-api-client
   read -rsp 'Old master key (Base64): ' WorkspaceRotation__OldMasterKey; echo
   read -rsp 'New master key (Base64): ' WorkspaceRotation__NewMasterKey; echo
   export WorkspaceRotation__OldMasterKey WorkspaceRotation__NewMasterKey
   export WorkspaceRotation__OldMasterKeyId='master-v1'
   export WorkspaceRotation__NewMasterKeyId='master-v2'
   export WorkspaceRotation__ExpectedWorkspaces='3'  # REPLACE with verified count
   backend/scripts/rotate-workspace-master-key.sh --dry-run --expect-database YOUR_DB_NAME
   ```

   Both keys are validated, all workspace wrappers are authenticated, new
   wrappers are rechecked, and no writes occur in dry-run mode. A wrong old key,
   unmatched master-key ID, missing Workspace wrapper, incorrect DB name or count
   causes the command to abort. The script sources `backend/.env` for the DB
   connection. Do not use `set -x` or print the environment variables.

4. When dry-run succeeds and backups have been verified, while **all writers
   remain stopped**, run:

   ```bash
   backend/scripts/rotate-workspace-master-key.sh --execute --expect-database YOUR_DB_NAME
   ```

   All wrapped DEKs are changed in **one SERIALIZABLE transaction**. Any failure
   rolls back the whole transaction. The tool never prints key material.
5. **Only after successful commit**, change both settings in `backend/.env` (or
   your deployment secret manager), in the same deployment:

   ```dotenv
   WorkspaceEncryption__MasterKey='NEW_BASE64_KEY_FROM_YOUR_VAULT'
   WorkspaceEncryption__MasterKeyId='master-v2'
   ```

   Restart the API, verify that old request contents can be opened, and create
   a new Workspace to confirm that new DEKs have the new ID. Do not destroy the
   old key until backups, rollback options, and verification are complete.
   Unset shell rotation variables after use (`unset WorkspaceRotation__OldMasterKey
   WorkspaceRotation__NewMasterKey`).

**Recovery after a successful commit but failed deployment:** keep the API
stopped. The database wrappers now require the *new* key. Fix the deployment
configuration, or run the same tool in reverse using old/new values and IDs
swapped, after a successful reverse dry-run. Do **not** simply switch back to
`master-v1` in `.env` without reversing the database transaction.

**Known limits:** This is an offline maintenance workflow with downtime, not a
seamless multi-key rollout. An already-running API process has its master key
cached in memory. Rotating only the configuration without performing the
transaction will make existing Workspace content unreadable. Maintain an
independent, tested database-and-keys disaster-recovery process.

## Browser data hardening (Phase 8)

- Workbench recovery keeps **Local** tabs only, regardless of Cloud member role.
  Workspace drafts, URLs, scripts and response bodies are no longer saved in
  `pakpost_workbench_v4_live` or `pakpost_workbench_v4_recovery`.
- Legacy Cloud entries are discarded when recovery is read. Cloud request tabs
  are intentionally **not restored after a browser refresh**; reopen them from
  the Workspace to reload from the authorized server.
- Collection-documentation sidecars previously stored in browser `localStorage`
  are migrated to `sessionStorage` and the durable entry removed. This is still
  **plaintext within the current browser session** and can be visible to local
  software/browser extensions; do not put credentials in documentation. Docs
  may be lost after the session ends. Long-term persistence belongs in an
  encrypted backend model, which is not implemented by this patch.
- Logout clears the Cloud documentation session sidecar along with auth and
  recovery state. The Local request tester keeps its existing recovery behavior.

These protections reduce browser-at-rest exposure but **do not provide E2EE**.
Scripts execute in the browser and authorized API responses are plaintext in
memory while a user is signed in. Review analytics/logging and Browser Extension
policy separately before using real production secrets.
