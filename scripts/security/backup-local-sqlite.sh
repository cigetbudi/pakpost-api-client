#!/usr/bin/env bash
# SQLite online backup captures committed WAL state; never overwrite source or old backups.
set -euo pipefail
umask 077
[[ $# -eq 2 && -f "$1" && -d "$2" ]] || { echo 'Usage: backup-local-sqlite.sh /path/to/pakpost-local.sqlite3 /private/backup-directory' >&2; exit 2; }
command -v sqlite3 >/dev/null
source_db=$(realpath "$1"); output_dir=$(realpath "$2")
work=$(mktemp -d); trap 'rm -rf -- "$work"' EXIT
(cd "$work" && sqlite3 -readonly "$source_db" '.backup snapshot.sqlite3')
[[ $(sqlite3 -readonly "$work/snapshot.sqlite3" 'PRAGMA integrity_check;') == ok ]] || { echo 'SQLite integrity check failed' >&2; exit 1; }
# Restore rehearsal into a separate temporary database, not the live one.
(cd "$work" && sqlite3 -readonly snapshot.sqlite3 '.backup restored.sqlite3')
[[ $(sqlite3 -readonly "$work/restored.sqlite3" 'PRAGMA integrity_check;') == ok ]] || exit 1
backup=$(mktemp "$output_dir/pakpost-local-XXXXXXXX.sqlite3")
if ! cat "$work/snapshot.sqlite3" > "$backup"; then rm -f -- "$backup"; exit 1; fi
printf 'Verified private SQLite backup: %s\n' "$backup"
echo 'Contains local request/history/environment data. Keep private; OS keyring is not included.'
