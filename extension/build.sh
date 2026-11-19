#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
for browser in chrome firefox; do
  out="dist/$browser"
  rm -rf "$out"
  mkdir -p "$out"
  cp common/{background.js,content.js,popup.html,popup.css,popup.js} "$out/"
  mkdir -p "$out/icons"
  cp common/icons/icon-*.png "$out/icons/"
  cp "manifest.$browser.json" "$out/manifest.json"
  echo "Prepared $out"
done
