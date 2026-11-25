#!/usr/bin/env bash
# Run on the VPS only. Never regenerates or replaces an existing key pair.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo'; exit 1; }
command -v openssl >/dev/null || { echo 'openssl required'; exit 1; }
root=/var/lib/pakpost/data-protection
# UID/GID 1654:1654 is the non-root .NET chiseled runtime user in the PakPost Dockerfile.
uid=1654
gid=1654
umask 077
install -d -o root -g root -m 0755 /var/lib/pakpost "$root"
install -d -o "$uid" -g "$gid" -m 0700 "$root/keys"
install -d -o root -g "$gid" -m 0750 "$root/certificate"
cert="$root/certificate/cert.pem"
key="$root/certificate/key.pem"
# Refuse partial state or symlinks instead of risking irreversible key loss.
[[ ! -L "$cert" && ! -L "$key" ]] || { echo 'Unexpected symlink; inspect manually'; exit 1; }
if [[ -e "$cert" || -e "$key" ]]; then
  [[ -f "$cert" && -f "$key" ]] || { echo 'Incomplete certificate pair; restore the backup'; exit 1; }
else
  if [[ -n "$(find "$root/keys" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo 'Existing key ring but no certificate. Restore the certificate backup; refusing to generate a replacement.'; exit 1
  fi
  tmp=$(mktemp -d "$root/.cert.XXXXXX")
  trap 'rm -rf -- "$tmp"' EXIT
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 3650 \
    -subj '/CN=Pakpost Data Protection' \
    -addext 'keyUsage=critical,keyEncipherment,dataEncipherment' \
    -keyout "$tmp/key.pem" -out "$tmp/cert.pem" >/dev/null 2>&1
  install -o root -g "$gid" -m 0440 "$tmp/key.pem" "$key"
  install -o root -g "$gid" -m 0440 "$tmp/cert.pem" "$cert"
fi
# Verify key/cert match without printing any key material.
[[ "$(openssl x509 -in "$cert" -pubkey -noout | openssl sha256)" == "$(openssl pkey -in "$key" -pubout | openssl sha256)" ]] || { echo 'Certificate/key mismatch'; exit 1; }
openssl x509 -in "$cert" -checkend 86400 -noout >/dev/null || { echo 'Certificate expired or near expiry; plan rotation preserving old keys'; exit 1; }
chown root:"$gid" "$cert" "$key"
chmod 0440 "$cert" "$key"
echo '[OK] Persistent Data Protection directories and certificate ready. Back up both directories securely.'
