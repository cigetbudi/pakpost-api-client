#!/usr/bin/env bash
# One-time migration. Run from anywhere; never deletes npm lockfile without successful tests.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v bun >/dev/null || { echo 'Install Bun 1.4.4+ from https://bun.com/docs/installation' >&2; exit 1; }
echo "Using $(bun --version)"
if [[ -e bun.lock ]]; then
  echo 'Existing bun.lock found; reusing it.'
else
  if [[ ! -f package-lock.json ]]; then
    echo 'Missing package-lock.json; cannot preserve the npm dependency snapshot.' >&2
    exit 1
  fi
  echo 'Converting npm lockfile (versions preserved where supported)...'
  bun pm migrate
fi
bun install --frozen-lockfile
bun run test
bun run build
bun audit
printf '\nAll checks passed. The Bun lockfile is ready.\n'
printf 'Commit frontend/bun.lock; once CI also passes, remove frontend/package-lock.json.\n'
