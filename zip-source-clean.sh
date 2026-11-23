#!/usr/bin/env bash
set -euo pipefail

# PakPost source archive: run from anywhere inside the Git repository.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo 'ERROR: Run this script inside the PakPost Git repository.' >&2
  exit 1
fi

export PAKPOST_ARCHIVE_ROOT="$ROOT"
python3 <<'PY'
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

root = Path(os.environ['PAKPOST_ARCHIVE_ROOT']).resolve()
output = root.parent / f'{root.name}-source-clean.zip'

excluded_dirs = {
    '.git', 'node_modules', 'target', 'bin', 'obj', 'dist', 'build', 'coverage',
    'test-results', 'playwright-report', '.next', '.nuxt', '.output', '.turbo',
    '.vite', '.cache', '.venv', 'venv', '__pycache__', '.idea', '.terraform',
    'vendor', 'debug', 'release', 'publish', '.vs', '.vscode-test',
    '.pytest_cache', '.mypy_cache', '.gradle', '.pnpm-store',
}

excluded_names = {
    '.npmrc', '.pypirc', '.netrc', '.env', 'secrets.json', 'credentials.json',
    'token.json', 'launchsettings.json', 'id_rsa', 'id_ed25519',
    'known_hosts', 'config.json.user', 'desktop.ini', '.ds_store',
}

allowed_ext = {
    '.rs', '.cs', '.csproj', '.sln', '.slnx', '.props', '.targets',
    '.go', '.mod', '.sum', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.py', '.sh', '.ps1', '.bat', '.cmd', '.sql', '.json', '.jsonc',
    '.yaml', '.yml', '.toml', '.xml', '.html', '.css', '.scss',
    '.md', '.txt', '.svg', '.config', '.conf', '.ini', '.lock',
    '.proto', '.graphql', '.http', '.rest', '.gitignore', '.gitattributes',
    '.dockerignore', '.editorconfig', '.service', '.caddyfile',
}
allowed_names = {
    'dockerfile', 'makefile', 'license', 'readme', 'caddyfile',
    '.gitignore', '.gitattributes', '.dockerignore', '.editorconfig',
    '.env.example', '.env.sample', '.env.template',
    'bun.lock', 'cargo.lock', 'package-lock.json', 'pnpm-lock.yaml',
}

max_file_bytes = 5 * 1024 * 1024
max_archive_bytes = 100 * 1024 * 1024

# Include only expected image assets for desktop/app packaging.
def approved_asset(rel: Path) -> bool:
    s = rel.as_posix().lower()
    name = rel.name.lower()
    if s.startswith(('frontend/src-tauri/icons/', 'desktop/src-tauri/icons/')):
        return rel.suffix.lower() in {'.png', '.ico', '.icns'}
    if s.startswith('frontend/public/branding/'):
        return rel.suffix.lower() in {'.png', '.ico', '.webp'}
    if s.startswith('extension/common/icons/') and name.startswith('icon-'):
        return rel.suffix.lower() == '.png'
    return s == 'backend/src/pakpost.infrastructure/services/emailtemplates/pakpost-logo.png'

# Excludes backup and secrets, even when tracked by Git.
def is_sensitive(rel: Path) -> bool:
    name = rel.name.lower()
    parts = [p.lower() for p in rel.parts]
    if any(p in excluded_dirs for p in parts[:-1]):
        return True
    if name in excluded_names or (name.startswith('.env') and name not in allowed_names):
        return True
    if name.startswith('appsettings') and name.endswith('.json') and name != 'appsettings.example.json':
        return True
    if name.startswith('service-account') or name.startswith('service_account'):
        return True
    if name.endswith(('.key', '.pem', '.pfx', '.p12', '.p8', '.jks', '.keystore',
                      '.sqlite', '.sqlite3', '.db', '.db-wal', '.db-shm',
                      '.bak', '.backup', '.dump', '.patch', '.diff', '.log',
                      '.user', '.suo', '.pub', '.asc')):
        return True
    if name in {'id_rsa.pub', 'id_ed25519.pub'}:
        return True
    return False

result = subprocess.run(
    ['git', '-C', str(root), 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    check=True, stdout=subprocess.PIPE
)
paths = sorted(set(os.fsdecode(p) for p in result.stdout.split(b'\0') if p))

included = []
skipped = 0
skipped_reasons = {}
archive_bytes = 0

def skip(reason):
    global skipped
    skipped += 1
    skipped_reasons[reason] = skipped_reasons.get(reason, 0) + 1

with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for raw in paths:
        rel = Path(raw)
        if rel.is_absolute() or '..' in rel.parts:
            skip('unsafe path')
            continue
        path = root / rel
        if not path.is_file() or path.is_symlink():
            skip('missing / symlink')
            continue
        if is_sensitive(rel):
            skip('excluded / sensitive')
            continue
        name = rel.name.lower()
        is_asset = approved_asset(rel)
        if not is_asset and rel.suffix.lower() not in allowed_ext and name not in allowed_names:
            skip('extension not allowlisted')
            continue
        size = path.stat().st_size
        if size > max_file_bytes:
            skip('too large')
            continue
        if archive_bytes + size > max_archive_bytes:
            print('ERROR: Source archive size limit reached. No complete ZIP created.', file=sys.stderr)
            z.close()
            output.unlink(missing_ok=True)
            sys.exit(2)
        with path.open('rb') as f:
            head = f.read(4096)
        if is_asset:
            valid = (
                (name.endswith('.png') and head.startswith(b'\x89PNG\r\n\x1a\n')) or
                (name.endswith('.ico') and head.startswith(b'\x00\x00\x01\x00')) or
                (name.endswith('.icns') and head.startswith(b'icns')) or
                (name.endswith('.webp') and head.startswith(b'RIFF') and head[8:12] == b'WEBP')
            )
            if not valid:
                skip('invalid image signature')
                continue
        elif b'\0' in head:
            skip('binary content')
            continue
        z.write(path, arcname=rel.as_posix())
        included.append(rel.as_posix())
        archive_bytes += size

print('\n=== PAKPOST SOURCE ARCHIVE ===')
print(f'Archive : {output}')
print(f'Included: {len(included)} files')
print(f'Skipped : {skipped} files ({skipped_reasons})')
print(f'Size    : {output.stat().st_size / 1024 / 1024:.2f} MiB')

# Sanity checks: fail loudly if the archive omitted expected desktop commands.
source_root = 'desktop/src-tauri/src' if (root / 'desktop/src-tauri/src').exists() else 'frontend/src-tauri/src'
required = [f'{source_root}/lib.rs', f'{source_root}/database.rs', f'{source_root}/http.rs']
missing = [p for p in required if (root / p).is_file() and p not in included]
if missing:
    print('ERROR: Expected desktop source was not included:', *missing, sep='\n  ', file=sys.stderr)
    output.unlink(missing_ok=True)
    sys.exit(3)

for p in required:
    if not (root / p).is_file():
        print(f'WARNING: Not found in source tree: {p}')

with zipfile.ZipFile(output) as z:
    broken = z.testzip()
    if broken:
        print(f'ERROR: ZIP integrity failed at {broken}', file=sys.stderr)
        output.unlink(missing_ok=True)
        sys.exit(4)
print('ZIP integrity: OK')
print('WARNING: This filters file paths/types, NOT hardcoded secrets inside source files.')
print('Review ZIP before sharing (especially config, scripts, source constants).')
PY
