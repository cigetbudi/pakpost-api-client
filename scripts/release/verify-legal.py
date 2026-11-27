#!/usr/bin/env python3
"""Check packaging of legal documents, not license compliance."""
from pathlib import Path
import argparse
import json
import subprocess
import tempfile
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
EXTENSION = {
    'LICENSE.txt': 'LICENSE',
    'NOTICE.txt': 'NOTICE',
    'ADDITIONAL_TERMS.txt': 'ADDITIONAL_TERMS.md',
    'THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.md',
}
DESKTOP = {**EXTENSION, 'THIRD_PARTY_LICENSES.txt': 'THIRD_PARTY_LICENSES.txt'}
# Desktop keeps the original .md name for additional terms.
DESKTOP['ADDITIONAL_TERMS.md'] = DESKTOP.pop('ADDITIONAL_TERMS.txt')


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def source():
    for name in set(DESKTOP.values()) | {'docs/backend-third-party-licenses.txt'}:
        p = ROOT / name
        require(p.is_file() and p.stat().st_size > 0, f'Missing/empty legal file: {name}')
    bundle = json.loads((ROOT / 'desktop/src-tauri/tauri.conf.json').read_text(encoding='utf-8'))['bundle']
    require(bundle.get('license') == 'GPL-3.0-only', 'Incorrect desktop license metadata')
    require(bundle.get('licenseFile') == '../../LICENSE', 'Incorrect desktop licenseFile')
    resources = bundle.get('resources', {})
    for dest, original in DESKTOP.items():
        require(resources.get('../../' + original) == 'legal/' + dest,
                f'Missing desktop resource mapping: {dest}')
    print('PASS: legal files and desktop configuration (packaging only)')


def extension(path):
    with ZipFile(path) as archive:
        for dest, original in EXTENSION.items():
            require(archive.namelist().count(dest) == 1, f'{path.name}: missing or duplicate {dest}')
            require(archive.read(dest) == (ROOT / original).read_bytes(),
                    f'{path.name}: stale legal file {dest}')
    print(f'PASS: {path.name} legal contents')


def deb(path):
    with tempfile.TemporaryDirectory() as folder:
        subprocess.run(['dpkg-deb', '-x', str(path), folder], check=True)
        for dest, original in DESKTOP.items():
            matches = list(Path(folder).rglob('legal/' + dest))
            require(len(matches) == 1 and matches[0].is_file(), f'{path.name}: missing or duplicate {dest}')
            require(matches[0].read_bytes() == (ROOT / original).read_bytes(),
                    f'{path.name}: stale legal file {dest}')
    print(f'PASS: {path.name} legal contents')


def rpm(path):
    result = subprocess.check_output(['rpm', '-qpl', str(path)], text=True)
    paths = result.splitlines()
    for dest in DESKTOP:
        require(sum(p.endswith('/legal/' + dest) for p in paths) == 1,
                f'{path.name}: missing or duplicate {dest}')
    print(f'PASS: {path.name} legal file paths (contents not checked)')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['source', 'linux', 'extensions'])
    parser.add_argument('directory', type=Path, nargs='?')
    args = parser.parse_args()
    source()
    if args.mode != 'source':
        require(args.directory is not None and args.directory.is_dir(), 'Artifact directory required')
        checks = [('*.deb', deb), ('*.rpm', rpm)] if args.mode == 'linux' else [('*.zip', extension), ('*.xpi', extension)]
        for pattern, check in checks:
            paths = list(args.directory.glob(pattern))
            require(len(paths) == 1, f'Expected exactly one {pattern} in {args.directory}')
            check(paths[0])
    print('Packaging checks only: unresolved license obligations and corresponding source require review.')


if __name__ == '__main__':
    main()
