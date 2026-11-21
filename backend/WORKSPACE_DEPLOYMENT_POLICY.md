# PakPost workspace policies (Public vs SelfHosted)

This patch **does not alter** Google-only login, HttpOnly cookie sessions, workspace RBAC or encrypted secrets. It introduces an **instance-level** `Workspace Creator` grant that is independent of membership in any workspace.

## Configuration

Set exactly one environment variable **before** starting the API (no per-request toggle):

```bash
# Public hosted PakPost; any Google-verified account creates its own workspace.
Pakpost__DeploymentMode=Public

# OR self-hosted; only instance-approved creators can create workspaces.
Pakpost__DeploymentMode=SelfHosted
```

`SelfHosted` is the restricted default if this setting is absent. Unknown values cause a fail-closed exception when workspace policy is requested. Restart the API after changing it. Public always enforces **10 seats including Founder**; SelfHosted has **no member quota**. There is no blanket global workspace count limit in this release.

## Migration

Migration: `20261121220000_GlobalWorkspaceCreators`. Adds only `auth.users."CanCreateWorkspaces" BOOLEAN NOT NULL DEFAULT FALSE`; existing workspaces and roles stay unchanged.

Verify the target Neon branch, backup, review the generated SQL and apply:

```bash
cd backend
dotnet build Pakpost.slnx
dotnet test Pakpost.slnx
dotnet ef migrations list --project src/Pakpost.Infrastructure --startup-project src/Pakpost.Api --context PakpostDbContext
dotnet ef migrations script 20261121100000_AccountSessionHardening 20261121220000_GlobalWorkspaceCreators \
  --project src/Pakpost.Infrastructure --startup-project src/Pakpost.Api --context PakpostDbContext --output workspace-policy-migration.sql
./scripts/apply-migrations.sh --apply
```

A migration to an already running database may require only this migration; review `__EFMigrationsHistory` first.

## Admin bootstrap (SelfHosted)

There is deliberately **no public API for setting `IsSuperAdmin`**. Bootstrap one trusted instance admin using a restricted DBA connection **after that user has logged in with Google once**, and confirm the email, identity and exact user ID:

```sql
SELECT "Id", "Email", "IsSuperAdmin", "IsDisabled"
FROM auth.users WHERE "Email" = 'ADMIN_EMAIL_HERE';

-- After manually verifying the exact account and Google identity,
-- and only on the intended SELF-HOSTED installation:
UPDATE auth.users SET "IsSuperAdmin" = TRUE, "UpdatedAt" = NOW()
WHERE "Id" = 'VERIFIED_USER_UUID_HERE'::uuid AND "IsDisabled" = FALSE;
```

Then sign out/sign in again (to refresh the profile). Open **Settings → Instance admin**, search Jeffry and click **Grant creator**. Jeffry must sign in with Google at least once to have an account in the list. Granting the instance permission does **not** add Jeffry to any workspace.

Do not grant platform administrator rights to ordinary users. On Public installations, `CanCreateWorkspaces` is ignored; all Google accounts are authorized to create workspaces.

## Quota behavior

Public has a hard limit of 10 **reserved seats per workspace**: active members + distinct unexpired, unrevoked, unaccepted invitations. Adding an existing member, issuing an invitation, and accepting an invitation acquire a PostgreSQL `FOR UPDATE` row lock on the workspace, so two API instances cannot both overbook. A pending invitation for an existing member is not double counted; direct add to an email with an outstanding invite must revoke the invite first. SelfHosted has no quota (but writes still use the same lock for consistency).

Existing over-capacity Public workspaces are not deleted. New invitations/additions are rejected until capacity is available. An invitation cannot be accepted once active membership has already reached 10. Removing a workspace from the Public mode is not a data deletion operation; existing memberships persist.

## Manual smoke test

- Public: Google signup → create own workspace (Founder), invite 9, reject the next invitation with 409, revoke one pending invite, then allow another. A TeamLead of another workspace gives **no global create privilege**.
- SelfHosted: Google signup with no grant → `GET /api/workspaces/capabilities` returns `canCreateWorkspace: false` and POST `/api/workspaces` returns 403; Admin grants Workspace Creator → retry succeeds; revoke grant → existing workspaces remain accessible.
- SelfHosted: invite/add more than 10 people (no quota).
- Account admin: non-admin cannot call `/api/admin/platform/*`; admin cannot read workspace secrets through these endpoints.
- Verify frontend refresh, multi-tab sessions, workspace invitations and role management remain functional.

**Important:** Full .NET build and PostgreSQL integration must be run on the user's environment; the patch was prepared without a .NET SDK in the patching environment. For a real public deployment, also add abuse protections such as verified outbound email, rate limits and operational monitoring.

## Workspace Creator email invitations (Self-Hosted only)

Registered users are granted creation permission from **Settings → Instance admin**.
For an email address that has not yet registered, search for the complete email
address and choose **Invite via email**. This is an **instance-level invitation**,
not an invitation to become a member of an existing workspace.

- Pending invitations can be listed, resent (rotates the secret), or revoked by an instance administrator.
- The email uses the same Blueprint Courier / inline-logo SMTP branding as workspace invitations.
- A 256-bit random one-time token is sent by email; only its SHA-256 hash is stored in `auth.platform_creator_invitations`.
- The link expires after seven days. Only an authenticated, enabled user with a linked **Google identity** and the **exact invited email** can accept it.
- Acceptance atomically consumes the token and enables `auth.users."CanCreateWorkspaces"`. It does **not** create workspace memberships, grant Workspace roles, or expose secrets.
- The invitee opens the link, signs in with Google, and clicks **Activate Workspace Creator access**. A new Google account is created on first sign-in if the email is not already registered.

API endpoints:

```text
GET    /api/admin/platform/creator-invitations             (admin: pending)
POST   /api/admin/platform/creator-invitations             (admin: invite)
POST   /api/admin/platform/creator-invitations/{id}/resend (admin)
DELETE /api/admin/platform/creator-invitations/{id}        (admin)
POST   /api/admin/platform/creator-invitations/accept      (authenticated invitee)
```

Admin endpoints check `IsSuperAdmin` and account-enabled status in the database,
and all unsafe browser requests require the existing CSRF proof. Invitation
URLs are never returned by the API. `Invitations__FrontendBaseUrl` must use
HTTPS outside localhost, and existing `Invitations__Smtp__*` settings must be
configured. Browser logs must not record the invitation token.

Migration: `20261121233000_PlatformCreatorInvitations`. It adds a single table
under `auth`; no existing account, workspace, or membership data is deleted.
Before production, review the generated SQL on a Neon branch and verify real
SMTP delivery as well as unauthorized, wrong-email, expired, revoked and
concurrent acceptance cases.
