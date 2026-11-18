# Application use cases

Each feature keeps its existing C# namespace so controller DTOs, endpoint contracts, Mediator registrations, and integration code remain compatible with previous releases.

- `Commands/` — write operations and their requests.
- `Queries/` — read operations and their requests.
- `Handlers/` — one request handler per file.
- `Validators/` — FluentValidation types.
- `DTOs/` — application response and request models.
- `Services/` — feature-local helpers and security policies.
- `Interfaces/` — contracts local to the feature (e.g. request runner).

Do not put database access into API controllers. EF Core migrations and repositories stay in Infrastructure. Avoid logging user-supplied API request bodies, credentials, scripts, and decrypted variables.

Run `dotnet build backend/Pakpost.slnx` and `dotnet run --project backend/tests/Pakpost.SecurityChecks` after making changes. Frontend regression tests also assert the backend's security boundary.
