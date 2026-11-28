#!/usr/bin/env python3
"""Collect exactly one built artifact per slot; never manufacture installers."""
import json
import shutil
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
VERSION = json.loads((ROOT / "desktop/src-tauri/tauri.conf.json").read_text())["version"]
NAMES = {
    'deb': ('*.deb', f'PakPost-{VERSION}-linux-amd64.deb'),
    'rpm': ('*.rpm', f'PakPost-{VERSION}-linux-x86_64.rpm'),
    'windows': ('*-setup.exe', f'PakPost-{VERSION}-windows-x64.exe'),
    'mac-universal': ('*.dmg', f'PakPost-{VERSION}-macos-universal.dmg'),
    'chromium': ('pakpost-interceptor-chrome-v0.3.0.zip', 'pakpost-interceptor-chrome-v0.3.0.zip'),
    'firefox': ('pakpost-interceptor-firefox-v0.3.0.xpi', 'pakpost-interceptor-firefox-v0.3.0.xpi'),
}
def collect(source, output, slots, signed=False):
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
    if signed:
        for slot, (src, dst) in zip(slots, list(selected)):
            if slot in ('deb', 'rpm', 'windows'):
                signature = Path(str(src) + '.sig')
                if not signature.is_file() or signature.is_symlink() or not signature.stat().st_size:
                    raise SystemExit(f'Missing signature for {slot}')
                selected.append((signature, Path(str(dst) + '.sig')))
            if slot == 'mac-universal':
                matches = [p for p in source.rglob('*.app.tar.gz') if p.is_file() and not p.is_symlink()]
                if len(matches) != 1:
                    raise SystemExit('Expected exactly one macOS updater archive')
                updater = matches[0]
                signature = Path(str(updater) + '.sig')
                if not signature.is_file() or signature.is_symlink() or not signature.stat().st_size:
                    raise SystemExit('Missing macOS updater signature')
                target = output / f'PakPost-{VERSION}-macos-universal.app.tar.gz'
                selected.extend([(updater, target), (signature, Path(str(target) + '.sig'))])
    if any(dst.exists() for _, dst in selected):
        raise SystemExit('Refusing overwrite of release artifact')
    for src, dst in selected:
        shutil.copyfile(src, dst)
        print(dst.name)
if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit('Usage: collect.py <bundle-root> <output-dir> <slot> ...')
    root = Path(__file__).resolve().parents[2]
    for name in ("desktop/package.json", "desktop/src-tauri/tauri.conf.json", "frontend/package.json"):
        if json.loads((root/name).read_text())["version"] != VERSION:
            raise SystemExit(f"Version mismatch: {name}")
    collect(Path(sys.argv[1]), Path(sys.argv[2]), [arg for arg in sys.argv[3:] if arg != "--signed"], signed="--signed" in sys.argv[3:])
