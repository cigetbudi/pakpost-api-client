#!/usr/bin/env bash
# Interactive Linux smoke guard; start in Local Mode, no login or Send.
# Never disable WebKit sandbox or run the app as root.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
command -v strace >/dev/null || { echo 'Install strace first.' >&2; exit 2; }
binary="${1:-desktop/src-tauri/target/release/pakpost-desktop}"
[[ -x "$binary" ]] || { echo 'Build the production desktop binary first.' >&2; exit 2; }
umask 077
log=$(mktemp)
trap 'rm -f "$log"' EXIT
echo 'Use Local Mode without signing in or sending requests; then close the app.'
strace -f -tt -yy -s 0 -e trace=connect,sendto,sendmsg,sendmmsg -o "$log" "$binary"
[[ -s "$log" ]] || { echo 'FAIL: empty trace' >&2; exit 1; }
if grep -Eq 'sa_family=AF_INET6?[,}]|<(TCP|UDP)(v6)?:' "$log"; then
  echo 'FAIL: IP socket activity observed; investigate locally.' >&2
  exit 1
fi
echo 'PASS: no IPv4/IPv6 socket activity observed in traced calls.'
