# Pakpost Phase 2 — Mediator + Bun (performance-conscious migration)

Baseline: user-uploaded `pakpost-source-audit.zip` with Security Phase 1 patch applied. This is a **source-only incremental patch**; no Neon migration, schema changes, UI redesign, QuickJS runtime change, or Vite major upgrade.

## What changes

### Backend
- Removes the paid-license-bound `MediatR` 12.x dependency and uses **martinothamar/Mediator 3.0.2** (`Mediator.Abstractions` in Application and API; **`Mediator.SourceGenerator` only in executable API**).
- Converts **25 handler implementations** from `Task` to `ValueTask` return types, including 3 void-style commands returning `Unit`.
- Moves DI registration for the generated mediator into `Pakpost.Api/Program.cs`, pointing at Application message types; keeps `AddApplication()` for validators.
- Registers the **same FluentValidation behavior** through generated pipeline configuration. No validators or rules were deleted. For commands without validators, the pipeline directly returns the existing `ValueTask`, avoiding extra allocations; for validated commands, the pipeline reuses one ValidationContext and validates sequentially.
- **Scoped lifetime**, deliberately, not Singleton: handlers depend on scoped EF Core repositories and `DbContext`. This is safer; never change to singleton without redesigning dependencies and testing scope isolation.
- Existing HTTP proxy SSRF checks, Auth/Neon repositories, exception handling, schema/migrations, and Security Phase 1 restrictions are unchanged.

### Frontend
- Uses **Bun 1.4.4** for package install, scripts, and native unit tests; Vite and React remain unchanged.
- Changes `frontend/package.json` packageManager, test script (`bun test`), adds `test:node` fallback and `audit` script.
- Keeps **package-lock.json as the migration input** until a *real* `bun.lock` can be generated on the developer machine. This patch **does NOT include `bun.lock`**, because it cannot be generated or verified in the source-audit environment (no Bun binary and no registry network). Do not commit an invented lockfile.
- One-time `frontend/scripts/activate-bun.sh` runs `bun pm migrate`, `bun install --frozen-lockfile`, `bun run test`, `bun run build`, `bun audit`. It leaves the npm lockfile untouched, even if checks fail. Commit generated `bun.lock` and later remove the npm lockfile after CI passes.
- No new npm dependency, Vite/Web Worker/QuickJS source changes or forced dependency major upgrades.

## Installation from repo root

```bash
# Commit or stash your work and back up configuration first.
unzip pakpost-phase2-mediator-bun.zip
git apply --check pakpost-phase2-mediator-bun/phase2-mediator-bun.patch
git apply pakpost-phase2-mediator-bun/phase2-mediator-bun.patch
```

**If your local NuGet versions changed since the uploaded audit ZIP**, `git apply --check` can fail on a `.csproj` context hunk. Do not force. Reconcile the package block manually: retain your approved .NET 10 patch versions and add the Mediator references from this patch; remove MediatR in Application.

### Validate backend (requires .NET 10 SDK)

```bash
cd backend
dotnet restore Pakpost.slnx -p:NuGetAudit=true -p:NuGetAuditMode=all
dotnet build Pakpost.slnx -c Release --no-incremental
bash tests/check-mediator-migration.sh
bash tests/run-security-checks.sh
dotnet list Pakpost.slnx package --vulnerable --include-transitive
cd ..
```

**Compile-time generator warnings matter.** Confirm 25 handlers are generated/registered; runtime smoke test auth, workspace CRUD, collection CRUD, environment redaction, authorization 403, and proxy request/response. `dotnet build` was not available where this patch was authored, so this is a required gate, not a formality.

### Activate Bun (requires installed Bun 1.4.4+)

```bash
bun --version
cd frontend
bash scripts/activate-bun.sh
# bun.lock should now exist. Keep and commit it:
git add package.json bun.lock scripts/activate-bun.sh
# Once verified in your CI and on other dev machines, remove package-lock.json.
bun run dev
```

Future CI installs should use `cd frontend && bun install --frozen-lockfile && bun run test && bun run build && bun audit` after `bun.lock` is committed. `bun audit` checks published advisories, not source-code flaws.

### Performance comparison (not guesses)

Measure on the same machine with warm and cold dependency caches (record the conditions), e.g.:

```bash
cd frontend
/usr/bin/time -f 'Bun build elapsed=%e s peak_rss=%M KB' bun run build
/usr/bin/time -f 'Bun test elapsed=%e s peak_rss=%M KB' bun run test
# Compare before/after HTTP p95 latency under the same .NET 10 and Neon conditions.
```

Do not interpret faster Bun installation as faster browser navigation: production frontend stays a Vite/React bundle. Real request latency also depends on Neon and outbound HTTP, not just Mediator dispatch.

## Rollback

```bash
git apply --reverse --check pakpost-phase2-mediator-bun/phase2-mediator-bun.patch
git apply --reverse pakpost-phase2-mediator-bun/phase2-mediator-bun.patch
```

If you generated `frontend/bun.lock`, remove it separately **only when reverting**; it is an untracked generated file and not part of this patch. No DB rollback is necessary.

## Verification status

- All 90 existing frontend tests passed with **Node 22** on the packaged source. Four Phase 2 static regression tests also passed under Node (94 total).
- Mediator source generator APIs/registration/lifetimes checked against upstream `martinothamar/Mediator` docs and NuGet 3.0.2.
- **Cannot verify** .NET build, Bun-native test, Bun install, lockfile generation, Vite production build, or runtime benchmarks in this restricted environment. Test on your machine before production.
