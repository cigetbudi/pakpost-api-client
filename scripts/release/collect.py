#!/usr/bin/env python3
"""Collect exactly one built artifact per slot; never manufacture installers."""
import json
import shutil
import sys
from pathlib import Path
NAMES = {
    'deb': ('*.deb', 'PakPost-0.1.1-linux-amd64.deb'),
    'rpm': ('*.rpm', 'PakPost-0.1.1-linux-x86_64.rpm'),
    'windows': ('*-setup.exe', 'PakPost-0.1.1-windows-x64.exe'),
    'mac-universal': ('*.dmg', 'PakPost-0.1.1-macos-universal.dmg'),
    'chromium': ('pakpost-interceptor-chrome-v0.3.0.zip', 'pakpost-interceptor-chrome-v0.3.0.zip'),
    'firefox': ('pakpost-interceptor-firefox-v0.3.0.xpi', 'pakpost-interceptor-firefox-v0.3.0.xpi'),
}
def collect(source, output, slots):
    output.mkdir(parents=True, exist_ok=True)
    selected = []
    for slot in slots:
        pattern, name = NAMES[slot]
        matches = sorted({p for glob in (pattern, name) for p in source.rglob(glob) if p.is_file() and not p.is_symlink()})
        if len(matches) != 1 or matches[0].stat().st_size < 8:
            raise SystemExit(f'{slot}: expected exactly one nonempty built file, got {len(matches)}')
        target = output / name
        if target.exists():
            raise SystemExit(f'Refusing overwrite: {target.name}')
        selected.append((matches[0], target))
    for src, dst in selected:
        shutil.copyfile(src, dst)
        print(dst.name)
if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit('Usage: collect.py <bundle-root> <output-dir> <slot> ...')
    root = Path(__file__).resolve().parents[2]
    for name in ("desktop/package.json", "desktop/src-tauri/tauri.conf.json", "frontend/package.json"):
        if json.loads((root/name).read_text())["version"] != "0.1.1":
            raise SystemExit(f"Version mismatch: {name}")
    collect(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:])
