#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# No MediatR dependency or namespace remains.
if grep -REn '(using MediatR;|Include="MediatR"|AddMediatR)' "$ROOT/src" --include='*.cs' --include='*.csproj'; then
  echo 'Unexpected MediatR reference remains' >&2
  exit 1
fi
# Preserve all handlers and cancellation tokens through migration.
if grep -REn 'public (async )?Task(<[^>]+>)? Handle\(' "$ROOT/src/Pakpost.Application/Internal" --include='*.cs'; then
  echo 'Legacy Task-returning handlers remain' >&2
  exit 1
fi
COUNT=$(grep -RE 'IRequestHandler<' "$ROOT/src/Pakpost.Application/Internal" --include='*.cs' | wc -l)
echo "Found $COUNT migrated request handlers."
[[ "$COUNT" -ge 20 ]] || { echo 'Missing request handlers' >&2; exit 1; }
