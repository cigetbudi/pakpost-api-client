#!/usr/bin/env python3
"""Generate installer-specific updater metadata, fail closed if any signature is missing."""
import base64
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION = json.loads((ROOT / 'desktop/src-tauri/tauri.conf.json').read_text())['version']
REPO = 'https://github.com/cigetbudi/pakpost-api-client'

def generate(folder, version=VERSION):
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version):
        raise ValueError('Expected a stable semantic version')
    targets = {
        'linux-x86_64-deb': f'PakPost-{version}-linux-amd64.deb',
        'linux-x86_64-rpm': f'PakPost-{version}-linux-x86_64.rpm',
        'windows-x86_64-nsis': f'PakPost-{version}-windows-x64.exe',
        'darwin-x86_64-app': f'PakPost-{version}-macos-universal.app.tar.gz',
        'darwin-aarch64-app': f'PakPost-{version}-macos-universal.app.tar.gz',
    }
    # Generic fallback is intentionally omitted for Linux: never cross-install DEB/RPM.
    targets.update({'windows-x86_64': targets['windows-x86_64-nsis'], 'darwin-x86_64': targets['darwin-x86_64-app'], 'darwin-aarch64': targets['darwin-aarch64-app']})
    platforms = {}
    for target, name in targets.items():
        asset, sig = folder / name, folder / (name + '.sig')
        for p in (asset, sig):
            if not p.is_file() or p.is_symlink() or p.stat().st_size < 8:
                raise ValueError(f'Missing or invalid: {p.name}')
        signature = sig.read_text().strip()
        decoded = base64.b64decode(signature, validate=True).decode('utf-8')
        if not any(line.startswith('trusted comment:') and re.search(r'(?:^|\s)version:' + re.escape(version) + r'(?:\s|$)', line) for line in decoded.splitlines()):
            raise ValueError(f'Signature has no matching signed version: {sig.name}')
        platforms[target] = {'url': f'{REPO}/releases/download/v{version}/{name}', 'signature': signature}
    return {'version': version, 'platforms': platforms}

if __name__ == '__main__':
    folder = Path(sys.argv[1]); manifest = generate(folder)
    output = folder / 'latest.json'
    if output.exists(): raise SystemExit('Refusing to overwrite latest.json')
    output.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print('Generated latest.json (signature format/version checked; cryptographic verification occurs in client).')
