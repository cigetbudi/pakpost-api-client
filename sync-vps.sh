#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

rsync -avz --info=progress2 \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='bin/' \
  --exclude='obj/' \
  --exclude='dist/' \
  --exclude='target/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.pakpost-last-backup*' \
  ./ ubuntu@43.129.56.58:/opt/pakpost/

echo "✅ Source PakPost berhasil disinkronkan!"
echo "Catatan: aplikasi production belum otomatis di-deploy."
