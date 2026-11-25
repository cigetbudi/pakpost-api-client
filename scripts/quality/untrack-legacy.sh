#!/usr/bin/env bash
# Explicit Git-index cleanup. Never deletes files from disk or rewrites history.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [[ $# -gt 1 || ( $# -eq 1 && "$1" != --apply ) ]]; then
  echo 'Usage: bash scripts/quality/untrack-legacy.sh [--apply]' >&2; exit 2
fi
paths=(frontend/kunci frontend/kunci.pub .pakpost-patch-backups frontend/src-tauri)
# Verify that a canonical desktop project is present before retiring the old copy.
[[ -f desktop/src-tauri/Cargo.toml && -f desktop/src-tauri/tauri.conf.json ]] || { echo 'Canonical desktop project missing; refusing cleanup' >&2; exit 1; }
for path in "${paths[@]}"; do
  if [[ -n "$(git ls-files -- "$path")" ]]; then
    printf 'Tracked cleanup candidate: %s\n' "$path"
  fi
done
if [[ ${1:-} != --apply ]]; then
  echo 'Dry run only. Review candidates and back up local changes before --apply.'
  exit 0
fi
# No -f: Git refuses removal if staged content is inconsistent.
git rm -r --cached --ignore-unmatch -- "${paths[@]}"
echo 'Index cleanup staged; working files remain. Move private keys outside this repo and revoke/rotate them.'
echo 'Review git status (do not share secret-bearing deletion diffs). Commit after review.'
echo 'This does not remove any earlier Git object, revoke a key, or clean remote history.'
