# Backend tests

PakPost has two independent .NET test projects:

- `Pakpost.UnitTests` uses xUnit and NSubstitute for application validators, folder rules, import operations, and authorization behavior.
- `Pakpost.SecurityChecks` is an executable set of security regressions that exercises existing application handlers without a live database.

Run from the repository root:

```bash
dotnet restore backend/Pakpost.slnx
dotnet build backend/Pakpost.slnx
dotnet test backend/tests/Pakpost.UnitTests/Pakpost.UnitTests.csproj --no-build
dotnet run --project backend/tests/Pakpost.SecurityChecks
```

These tests do not apply EF Core migrations or connect to NeonDB. Test migration, transaction rollback, and real PostgreSQL concurrency separately against an isolated database branch.
