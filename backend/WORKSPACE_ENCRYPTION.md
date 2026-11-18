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
