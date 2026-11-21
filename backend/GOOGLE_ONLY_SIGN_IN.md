# Google-only PakPost sign-in (interim social-login policy)

Public and self-hosted instances use Google Sign-In for normal browser authentication.
`POST /api/auth/google` verifies the Google ID token server-side and creates the account when needed.
PakPost still issues its own HttpOnly PostgreSQL-backed browser session; it does not place Google tokens in local/session storage.

## Configuration

- Frontend: `VITE_GOOGLE_CLIENT_ID` (Google OAuth web client ID).
- Backend: `Google:ClientId` must be the same web client ID.
- Google Cloud authorized JavaScript origins must include the actual frontend HTTPS origin (localhost for development).
- `Authentication:EnableLegacyPasswordLogin` defaults to `false`. Password *registration* is always disabled.
- The legacy login route is only for account migration and must not be enabled on public production unless there is a controlled migration window.

## BEFORE switching an existing deployment to Google-only

Google login intentionally does NOT link an existing password account solely because the email matches.
Existing users must link Google to their existing PakPost account **while still authenticated**, using Profile → Connect Google and their legacy password.
Otherwise they will be unable to sign in to that existing account after password login is disabled; they must contact an instance administrator.
**Do not delete or recreate their user**, or existing workspace ownership/invitations may become inaccessible.

Check remaining unlinked accounts (these can include intentionally dormant users):

```sql
SELECT count(*) AS accounts_without_google_identity
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.user_external_identities i
  WHERE i."UserId" = u."Id" AND i."Provider" = 'google'
);
```

For a controlled rollback/migration only, on a trusted instance set `Authentication__EnableLegacyPasswordLogin=true`, restart the API, and use the legacy `POST /api/auth/login` flow to establish a browser session; then use Profile → Connect Google. Reset the setting to `false` immediately afterwards. `POST /api/auth/register` remains disabled.

## Verification

- Guest sign-in dialog only offers Google; no password, email or sign-up form.
- New verified Google identity can register automatically; subsequent sign-ins reuse its immutable provider subject.
- Existing unlinked email conflict does not silently merge accounts.
- `POST /api/auth/register` returns HTTP 410; `POST /api/auth/login` returns HTTP 410 by default.
- Google login sets an HttpOnly session cookie, not a JWT in browser storage.
- Existing session restore, invitation accept, logout, active sessions and revoke still work.

For future GitHub sign-in, add a new external identity provider using the existing provider + subject mapping; do not merge accounts by matching email alone.

Workspace creation policy and public 10-member quotas are a separate feature, **not changed by this patch**.
