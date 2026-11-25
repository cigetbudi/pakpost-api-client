# D5 public pilot guard patch

Scope: conservative changes to the **cleaned D5 source** from 2026-11-23. This is NOT a production release and has NOT been compiled or security-tested in this environment.

Changes:
- Remove redundant `DesktopPairingStore` DI registration (no functional change intended).
- Require `DesktopAuth:AllowedUserIds` for browser approval. Empty/missing/invalid list => all approvals forbidden (403). This limits which accounts can approve desktop access; it does **not** limit unauthenticated pairing creation. Keep existing rate limiting.
- Reject `Authorization: PakpostDesktop` when `DesktopAuth:Enabled` is false, including preexisting desktop sessions.

## Applying

From the repository root on `feature/desktop-tauri` (after reviewing `git status`):

```sh
unzip -o /path/to/pakpost-d5-public-pilot-guard.zip -d .
dotnet build backend/src/Pakpost.Api/Pakpost.Api.csproj
# Run disposable DB integration tests using your existing configured script:
cd backend && ./scripts/verify-postgres-integration.sh
```

## Pilot configuration (ONLY after successful tests, preflight, and rollback preparation)

Use an **actual** account's GUID as shown by the existing `/api/auth/me` JSON response when signed into PakPost Web (field `id`). Never guess an ID. Example environment variable layout:

```sh
DesktopAuth__Enabled=true
DesktopAuth__AllowedUserIds__0=<YOUR_USER_GUID>
```

When `DesktopAuth__Enabled=false`, pairing endpoints remain disabled and existing desktop header credentials are rejected. Add only authorized tester user IDs. Do not expose any deviceSecret, JWT signing key, or database credentials in logs or chats.

## Required testing before internet exposure

- Existing Google web login/logout and CSRF still work.
- Non-allowlisted account receives 403 on `/api/desktop-auth/approve` despite being logged in.
- Allowlisted account can approve only with browser cookie and CSRF proof; desktop authorization header cannot approve.
- Wrong/expired device secret never creates sessions; valid pairing only consumed once.
- Desktop logout revokes session; switched profile cannot reuse another server's token.
- Workspace GET and CRUD honor account role and workspace membership; Local SQLite unchanged.
- DesktopAuth disabled => start/poll 404 and `PakpostDesktop` auth rejected.
- If these tests are not all satisfied, leave flag disabled on public VPS.

**Important limitation:** This guard patch does not implement automated authorization security tests, distributed pairing storage, a hardened production release, or end-to-end Google desktop flow. It is a prerequisite to a narrowly scoped public pilot, not a sign-off.
