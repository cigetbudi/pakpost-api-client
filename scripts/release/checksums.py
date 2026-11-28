#!/usr/bin/env python3
import hashlib, sys
from pathlib import Path
from collect import NAMES
root = Path(sys.argv[1])
required = {name for _, name in NAMES.values()}
files = sorted(p for p in root.iterdir() if p.name != 'SHA256SUMS')
if not required.issubset({p.name for p in files}):
    raise SystemExit('Missing expected distribution files')
lines=[]
for p in files:
    if not p.is_file() or p.is_symlink() or p.stat().st_size < 8:
        raise SystemExit(f'Invalid artifact: {p.name}')
    with p.open('rb') as handle:
        lines.append(f'{hashlib.file_digest(handle,"sha256").hexdigest()}  {p.name}\n')
(root/'SHA256SUMS').write_text(''.join(lines),encoding='utf-8')
print('Checksums generated for all distribution assets.')
