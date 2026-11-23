#!/usr/bin/env bash
set -Eeuo pipefail

# PakPost safe source exporter. Read-only for project source files.
# Run anywhere inside the Git repository: bash zip-pakpost-source.sh
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo 'ERROR: Run this from inside the PakPost Git repository.' >&2
  exit 1
fi

export PAKPOST_EXPORT_ROOT="$ROOT"
python3 - <<'PY'
from __future__ import annotations
import os
import re
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path

root = Path(os.environ['PAKPOST_EXPORT_ROOT']).resolve()
if not (root / 'frontend').is_dir() or not (root / 'backend').is_dir():
    sys.exit('ERROR: Expected frontend/ and backend/ at repository root.')

# Write beside repo, not inside: avoids accidentally archiving older archives.
output = root.parent / f'{root.name}-source-review-{datetime.now():%Y%m%d-%H%M%S}.zip'

# All tracked + untracked, excluding Git-ignored content.
proc = subprocess.run(
    ['git', '-C', str(root), 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    check=True, capture_output=True,
)
paths = sorted(set(os.fsdecode(p) for p in proc.stdout.split(b'\x00') if p))

# Explicitly reject local config, databases, certs and credentials regardless of Git tracking.
skip_dirs = {
    '.git', 'node_modules', 'target', 'bin', 'obj', 'dist', 'build', 'out', 'publish',
    'coverage', 'test-results', 'playwright-report', '.next', '.nuxt', '.output',
    '.turbo', '.vite', '.cache', '.venv', 'venv', '__pycache__', '.idea', '.vs',
    '.vscode-test', '.terraform', '.gradle', 'debug', 'release', 'artifacts',
    'logs', 'tmp', 'temp', '.local', '.cargo', 'TestResults',
}
skip_exact = {
    '.npmrc', '.pypirc', '.netrc', '.pgpass', '.env', '.env.local',
    'secrets.json', 'credentials.json', 'token.json', 'service-account.json',
    'id_rsa', 'id_ed25519', 'known_hosts', 'launchsettings.json',
}
skip_extensions = {
    '.db', '.sqlite', '.sqlite3', '.pem', '.key', '.pfx', '.p12', '.p8',
    '.jks', '.keystore', '.crt', '.cer', '.der', '.asc', '.gpg', '.age',
    '.log', '.bak', '.swp', '.swo', '.tmp', '.dump', '.backup', '.orig',
    '.zip', '.7z', '.rar', '.tar', '.gz', '.tgz', '.zst', '.exe', '.dll',
    '.so', '.dylib', '.class', '.pyc',
}
source_extensions = {
    '.rs', '.cs', '.csproj', '.sln', '.slnx', '.props', '.targets',
    '.go', '.mod', '.sum', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.py', '.sh', '.sql', '.json', '.jsonc', '.yaml', '.yml', '.toml',
    '.xml', '.html', '.css', '.scss', '.md', '.txt', '.svg', '.lock',
    '.config', '.conf', '.ini', '.proto', '.graphql', '.http', '.rest',
    '.c', '.h', '.cpp', '.hpp', '.gitignore', '.dockerignore', '.gitattributes',
    '.editorconfig', '.properties', '.pub', '.wasm', '.mts', '.cts',
}
source_filenames = {
    'dockerfile', 'makefile', 'license', 'readme', 'caddyfile',
    'bun.lock', 'cargo.lock', 'package-lock.json', 'pnpm-lock.yaml',
    'yarn.lock', 'global.json', 'nuget.config', 'compose.yaml', 'compose.yml',
    '.env.example', '.env.sample', '.env.template',
}
# Only include binaries essential for runtime/build (icons, fonts, assets).
asset_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.ico', '.icns', '.gif', '.woff', '.woff2', '.ttf', '.otf', '.wasm'}
asset_prefixes = (
    'frontend/public/', 'frontend/src/assets/', 'frontend/src-tauri/icons/',
    'desktop/src-tauri/icons/', 'extension/common/icons/',
    'backend/src/Pakpost.Infrastructure/Services/EmailTemplates/',
)
MAX_FILE = 12 * 1024 * 1024

# Known high-risk filenames/patterns across the repo.
def reason_to_skip(rel: Path) -> str | None:
    parts = rel.parts
    if any(p.lower() in {x.lower() for x in skip_dirs} for p in parts[:-1]):
        return 'generated/third-party directory'
    name = rel.name.lower()
    if name in skip_exact:
        return 'sensitive filename'
    if name.startswith('.env') and name not in {'.env.example', '.env.sample', '.env.template'}:
        return 'environment file'
    if (name.startswith('appsettings') and name.endswith('.json') and
            name not in {'appsettings.example.json', 'appsettings.sample.json', 'appsettings.template.json'}):
        return 'appsettings may contain secrets'
    if re.search(r'(?:^|[._-])(secret|password|credential|private[-_]?key|service[-_]?account)(?:[._-]|$)', name):
        return 'potential credential filename'
    if name.endswith(('-wal', '-shm')) or rel.suffix.lower() in skip_extensions:
        return 'database/credential/build/archive file'
    if name in source_filenames or rel.suffix.lower() in source_extensions:
        return None
    if rel.suffix.lower() in asset_extensions and rel.as_posix().startswith(asset_prefixes):
        return None
    return 'non-source asset'

included: list[str] = []
ignored = []
large = []
invalid = []
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for entry in paths:
        rel = Path(entry)
        path = root / rel
        if not path.is_file() or path.is_symlink():
            continue
        skip = reason_to_skip(rel)
        if skip:
            ignored.append((entry, skip))
            continue
        if path.stat().st_size > MAX_FILE:
            large.append(entry)
            continue
        if rel.suffix.lower() not in asset_extensions:
            with path.open('rb') as fh:
                if b'\0' in fh.read(4096):
                    invalid.append(entry)
                    continue
        z.write(path, entry)
        included.append(entry)

    # Audit manifest records what was packaged without containing file contents.
    required = [
        'desktop/src-tauri/src/lib.rs',
        'desktop/src-tauri/src/database.rs',
        'desktop/src-tauri/src/http.rs',
        'desktop/src-tauri/src/profiles.rs',
        'desktop/src-tauri/src/remote.rs',
        'desktop/src-tauri/Cargo.toml',
        'frontend/vite.config.js',
    ]
    missing = [p for p in required if p not in included]
    summary = [
        '# PakPost source export manifest',
        f'Created: {datetime.now().isoformat(timespec="seconds")}',
        f'File count: {len(included)}',
        f'Skipped by policy: {len(ignored)}',
        f'Skipped size limit: {len(large)}',
        f'Skipped binary sniff: {len(invalid)}',
        '',
        '## Desktop D5 files missing from archive',
        *(f'- {m}' for m in missing),
        '' if missing else '- None',
        '',
        '## Important',
        '- The script does NOT delete or edit repository files.',
        '- Secret-like file names are excluded, but hardcoded secrets in source cannot be reliably detected.',
        '- Review files/ZIP before uploading; especially .env.example files and source literals.',
        '- .gitignore excluded files are omitted by git ls-files unless already tracked.',
    ]
    z.writestr('SOURCE-EXPORT-MANIFEST.md', '\n'.join(summary) + '\n')

with zipfile.ZipFile(output) as z:
    corrupt_member = z.testzip()
    if corrupt_member:
        output.unlink(missing_ok=True)
        sys.exit(f'ERROR: ZIP integrity check failed: {corrupt_member}')

print('\n=== PAKPOST SOURCE EXPORT ===')
print(f'ZIP      : {output}')
print(f'Included : {len(included)} source/assets files')
print(f'Skipped  : {len(ignored)} by policy, {len(large)} too large, {len(invalid)} binary')
print(f'Size     : {output.stat().st_size / 1024 / 1024:.2f} MiB')
print('Integrity: OK')
print('Project  : NOT MODIFIED')
if missing:
    print('\nWARNING: Expected D5 desktop files missing:')
    for p in missing:
        print('  -', p)
    print('Check that you are on the latest desktop branch and that files are not ignored.')
else:
    print('Desktop D5: expected core files present')
if large:
    print('\nWARNING: Large files excluded:')
    for p in large[:12]:
        print('  -', p)
    if len(large) > 12:
        print(f'  ... and {len(large)-12} more')
print('\nIMPORTANT: Review ZIP for hardcoded secrets before sharing.')
PY
