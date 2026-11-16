# PakPost V7.1 — Google Sign-In (incremental from V6)

## 0. Security
- **Do not commit or upload the downloaded Google OAuth JSON**. Its `client_secret` is private.
- Only copy **`web.client_id`** from the JSON. We use Google Identity Services ID tokens; no Google Client Secret is needed.
- The app does NOT auto-link accounts by email. Existing password users must sign in and choose **Connect Google** (requires their PakPost password, plus a Google account with the same verified email).
- Google-only signups get an unguessable random local password. No password login until a future explicit password-set/reset feature.

## 1. Configure frontend
From the project root:

```sh
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local and set VITE_GOOGLE_CLIENT_ID=<your Web client ID>
```

Never use any Google secret in a VITE_ variable. The public client ID is intended for browser use. `frontend/.env.local` is ignored by Git.

## 2. Configure backend
Append one setting to your existing backend/.env (already read by backend/scripts/run.sh):

```sh
Google__ClientId='<same Web client ID>'
```

Do not replace your existing database connection string or JWT signing key. No full JSON credentials file is required by backend.

## 3. Verify Google Console Web OAuth client configuration
Authorized JavaScript origins: `http://127.0.0.1:5173`, `http://localhost:5173` (only use actual origins from which PakPost runs).
No redirect URI needed for the Google Identity Services **JavaScript callback** flow.
In Testing mode, add your Google account to the Test users list.
If using an office-hosted domain, use HTTPS and add the exact production origin; adjust CORS appropriately.

## 4. Back up DB and migrate (one new table, not destructive)
This patch includes EF Core migration `20261116103000_GoogleIdentities`, adding only `auth.user_external_identities` plus unique indexes/FK. **Inspect it before applying.**

```sh
cd backend
# Make sure your existing env values are loaded (your run scripts handle this)
dotnet restore Pakpost.slnx
dotnet build Pakpost.slnx
# Use your existing configured migration wrapper after backing up the Neon database:
./scripts/apply-migrations.sh --apply
./scripts/run.sh
```

## 5. Start frontend

```sh
cd frontend
bun install
bun run build
bun test
bun run dev
```

Open `http://127.0.0.1:5173`. Google button appears in Sign in dialog when `VITE_GOOGLE_CLIENT_ID` is set.

## 6. Test scenarios
- **Existing user:** sign in via password first; click **Connect Google** in header; enter PakPost password and select the Google account with identical verified email; logout; sign in with Google. Existing workspace IDs and roles should remain unchanged.
- **New user:** sign in with Google; account is created and has no workspaces by default.
- **Google account with same email but unlinked:** Google sign-in must respond HTTP 409 with instructions to connect it (no implicit account takeover).
- **Wrong Google ID token, wrong audience, expired token:** expect HTTP 401.
- **Wrong link password:** expect HTTP 401.
- **Different Google email on link:** expect HTTP 403.
- **Duplicate Google subject or second Google link:** expect HTTP 409; uniqueness constraints reject races.
- **No configured client ID:** Google button hidden; email/password remains functional.
- **Unauthenticated link request:** HTTP 401.

## Notes
- Do not confuse Google login identity with workspace authorization. Google login grants no Workspace membership automatically.
- New package `Google.Apis.Auth` is used for signature/audience/issuer/expiry checks with Google key rotation.
- This is a hand-authored migration (the .NET SDK is not available in the current artifact-building environment); review and run `dotnet build` and migrations on your machine before using production DB.
