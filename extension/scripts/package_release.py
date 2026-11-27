#!/usr/bin/env python3
"""Produce reproducible unsigned browser-store upload artifacts, no dependencies."""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'releases'
REQUIRED = {
    'manifest.json', 'background.js', 'content.js', 'popup.html',
    'popup.css', 'popup.js', 'icons/icon-16.png', 'icons/icon-32.png',
    'icons/icon-48.png', 'icons/icon-128.png',
    'LICENSE.txt', 'NOTICE.txt', 'ADDITIONAL_TERMS.txt',
    'THIRD_PARTY_NOTICES.md',
}


def read_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text(encoding='utf-8'))
    assert manifest['manifest_version'] == 3
    assert 'update_url' not in manifest, 'Unreviewed update origin in manifest'
    assert manifest['optional_host_permissions'] == ['http://*/*', 'https://*/*']
    assert re.fullmatch(r'\d+\.\d+\.\d+(?:\.\d+)?', manifest['version'])
    return manifest


def add_file(archive: ZipFile, relative: str, content: bytes) -> None:
    info = ZipInfo(relative, (2020, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    archive.writestr(info, content, compresslevel=9)


def main() -> None:
    source = {
        browser: read_manifest(ROOT / f'manifest.{browser}.json')
        for browser in ('chrome', 'firefox')
    }
    version = source['chrome']['version']
    if source['firefox']['version'] != version:
        raise SystemExit('Chrome / Firefox manifest versions differ')
    github_ref = os.environ.get('GITHUB_REF_NAME', '')
    if github_ref.startswith('interceptor-v') and github_ref != f'interceptor-v{version}':
        raise SystemExit('Git tag does not match extension manifest version')

    OUT.mkdir(exist_ok=True)
    checksums = []
    for browser, original in source.items():
        folder = ROOT / 'dist' / browser
        if not folder.exists():
            raise SystemExit('Run bash extension/build.sh first')
        built = read_manifest(folder / 'manifest.json')
        if built != original:
            raise SystemExit(f'{browser} build manifest is stale')
        found = {p.relative_to(folder).as_posix() for p in folder.rglob('*') if p.is_file()}
        if found != REQUIRED:
            raise SystemExit(f'{browser} build file mismatch: missing={REQUIRED-found}, extra={found-REQUIRED}')
        if browser == 'firefox' and not built.get('browser_specific_settings', {}).get('gecko', {}).get('id'):
            raise SystemExit('Firefox stable add-on ID is required for updates')

        extension = 'zip' if browser == 'chrome' else 'xpi'
        output = OUT / f'pakpost-interceptor-{browser}-v{version}.{extension}'
        with ZipFile(output, 'w') as archive:
            for relative in sorted(REQUIRED):
                add_file(archive, relative, (folder / relative).read_bytes())
        sha256 = hashlib.sha256(output.read_bytes()).hexdigest()
        checksums.append(f'{sha256}  {output.name}')
        print(f'PACKAGED {output.relative_to(ROOT)} ({sha256})')

    (OUT / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n', encoding='utf-8')
    print('The Firefox XPI is UNSIGNED. Submit it for Mozilla signing before permanent installation.')
    print('Unpacked Chrome installs are NOT automatically updated. Publish in the Chrome Web Store')
    print('or use an organization-managed distribution channel for browser-managed updates.')


if __name__ == '__main__':
    main()
