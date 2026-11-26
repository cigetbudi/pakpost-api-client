#!/usr/bin/env python3
import hashlib
import sys
from pathlib import Path
root = Path(sys.argv[1])
names = ['PakPost-0.1.0-linux-amd64.deb','PakPost-0.1.0-linux-x86_64.rpm','PakPost-0.1.0-windows-x64.exe','PakPost-0.1.0-macos-universal.dmg','pakpost-interceptor-chrome-v0.3.0.zip','pakpost-interceptor-firefox-v0.3.0.xpi']
lines=[]
for name in sorted(names):
    path=root/name
    if not path.is_file() or path.is_symlink() or path.stat().st_size<8:
        raise SystemExit(f'Missing or invalid: {name}')
    with path.open('rb') as handle:
        digest=hashlib.file_digest(handle,'sha256').hexdigest()
    lines.append(f'{digest}  {name}\n')
(root/'SHA256SUMS').write_text(''.join(lines),encoding='utf-8')
print('Checksums generated for six expected artifacts; signing and installer smoke tests are separate.')
