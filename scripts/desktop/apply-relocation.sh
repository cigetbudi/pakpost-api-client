#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
[[ -f desktop/src-tauri/tauri.conf.json ]] || { echo 'Missing desktop source; unzip patch into repository root first'; exit 1; }
[[ -f frontend/src-tauri/tauri.conf.json ]] || { echo 'Old Tauri folder not present (already migrated?)'; exit 0; }
# Do not remove user changes until confirmed that every old file is identical to supplied archive.
if diff -qr frontend/src-tauri desktop/src-tauri --exclude=tauri.conf.json --exclude=target --exclude=gen >/dev/null; then
  echo 'Old folder matches new native source (except configuration).'
  mv frontend/src-tauri "frontend/src-tauri.backup-$(date +%Y%m%d%H%M%S)"
  echo 'Previous Tauri tree preserved in frontend/src-tauri.backup-*; remove backup only after verified build.'
else
  echo 'Old and new native source differ. Leaving frontend/src-tauri in place for manual review.'
fi
