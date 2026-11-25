#!/usr/bin/env bash
# Sync only web runtime sources. Dry-run unless --apply is supplied.
set -euo pipefail
cd "$(dirname "$0")"
if [[ $# -lt 2 || $# -gt 3 || ( $# -eq 3 && "$3" != --apply ) ]]; then
  echo 'Usage: bash sync-vps.sh user@host /absolute/deploy/path [--apply]' >&2
  echo 'Set SSH_PORT if needed (default 22). No deploy or delete.' >&2
  exit 2
fi
host=$1; path=$2; port=${SSH_PORT:-22}
[[ "$host" =~ ^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$ && "$path" =~ ^/[a-zA-Z0-9_./-]+$ && "$port" =~ ^[0-9]+$ ]] || { echo 'Invalid destination or port' >&2; exit 2; }
args=( -avz --relative --info=progress2 -e "ssh -p $port" )
[[ ${3:-} == --apply ]] || args+=( --dry-run )
rsync "${args[@]}" \
  --exclude='.git/' --exclude='.env' --exclude='.env.*' --exclude='*.env' \
  --exclude='appsettings*.json' --exclude='secrets.json' --exclude='kunci*' \
  --exclude='id_rsa*' --exclude='id_ed25519*' --exclude='id_ecdsa*' --exclude='.ssh/' \
  --exclude='*.pem' --exclude='*.key' --exclude='*.pfx' --exclude='*.p12' \
  --exclude='*.db*' --exclude='*.sqlite*' --exclude='*.dump' --exclude='*.log' \
  --exclude='node_modules/' --exclude='bin/' --exclude='obj/' --exclude='dist/' \
  --exclude='target/' --exclude='src-tauri/' --exclude='src-tauri.backup-*/' \
  --exclude='playwright-report/' --exclude='test-results/' --exclude='TestResults/' \
  --exclude='.pakpost-patch-backups/' --exclude='artifacts/' \
  ./frontend/ ./backend/ ./docker/ ./scripts/production/ \
  ./compose.yaml ./compose.production-hardening.yaml ./.dockerignore "$host:$path/"
echo 'Source sync only; review deployment separately. Exclusions are not a substitute for secret scanning.'
