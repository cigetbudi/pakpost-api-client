# Contributing

Use the [development guide](docs/development.md) and [testing guide](docs/testing.md). Keep changes scoped and explain the user-visible behavior, security implications, migrations, and test results (including skipped tests). Prefer a regression test that fails before the fix; retain existing architecture/security guards unless their contract is explicitly replaced.

Use the repository's `.editorconfig`, preserve current Domain/Application/Infrastructure/API boundaries, and use existing frontend components and styles. Keep Bun and Cargo lockfiles consistent; do not add another package manager without agreement. Migrations must be additive where possible, reviewed and tested on a disposable database. Never commit credentials or local build/runtime artifacts. Do not attach real API payloads or internal company data to issues.

v0.1.0 is feature-frozen. Coordinate new capabilities separately. The project has no declared redistribution license in the supplied source; obtain the maintainer's permission before redistribution. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
