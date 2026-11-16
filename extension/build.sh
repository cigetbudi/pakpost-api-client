#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
for browser in chrome firefox; do
  out="dist/$browser"
  mkdir -p "$out"
  cp common/{background.js,content.js,popup.html,popup.css,popup.js} "$out/"
  cp "manifest.$browser.json" "$out/manifest.json"
  echo "Prepared $out"
done
