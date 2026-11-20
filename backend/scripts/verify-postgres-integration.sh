
#!/usr/bin/env bash

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

env_file="$root/backend/.env.integration"

if [[ -f "$env_file" ]]; then
    set -a
    source "$env_file"
    set +a

    echo "Loaded integration environment"
else
    echo "Integration environment file not found: $env_file" >&2
    exit 1
fi

if [[ -z "${PAKPOST_TEST_POSTGRES:-}" ]]; then
    echo "PAKPOST_TEST_POSTGRES is missing or empty." >&2
    exit 1
fi

if [[ "${PAKPOST_ALLOW_TEST_MIGRATIONS:-}" != "YES_DISPOSABLE_DB" ]]; then
    echo "Disposable database confirmation is required." >&2
    exit 1
fi

echo "Starting PostgreSQL integration tests..."

cd "$root"

dotnet test \
    backend/tests/Pakpost.IntegrationTests/Pakpost.IntegrationTests.csproj \
    --nologo
