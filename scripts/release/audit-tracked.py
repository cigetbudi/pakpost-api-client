#!/usr/bin/env python3
"""Fail on obvious secrets / legacy paths in a Git tree. Prints paths only.
Not a replacement for a full history secret scanner or manual review.
"""
import re
import subprocess
import sys
from pathlib import PurePosixPath

def git(*args):
    return subprocess.check_output(['git', *args])

def findings(tree):
    for item in git('ls-tree', '-rz', tree).split(b'\0'):
        if not item:
            continue
        meta, raw = item.split(b'\t', 1)
        mode, kind, oid = meta.decode().split()
        if kind != 'blob':
            continue
        path = raw.decode('utf-8', 'replace')
        name = PurePosixPath(path).name.lower()
        forbidden = (path.startswith(('.pakpost-patch-backups/', 'frontend/src-tauri/'))
                     or name in {'kunci', 'kunci.pub', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'secrets.json'}
                     or name.endswith(('.pem', '.pfx', '.p12', '.key', '.sqlite', '.sqlite3', '.dump', '.db'))
                     or ((name == '.env' or name.startswith('.env.')) and not name.endswith(('.example', '.sample', '.template'))))
        if forbidden:
            yield path, 'sensitive or obsolete tracked path'
            continue
        data = git('cat-file', 'blob', oid)
        # Match a complete private key block, not documentation about key markers.
        if re.search(rb'-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{40,}', data):
            yield path, 'private-key material'
        elif re.search(rb'postgres(?:ql)?://[^\s:/@]+:[^\s/@]+@[^\s/]+', data, re.I):
            # Examples need manual inspection; do not print the matched string.
            yield path, 'database URL with password: review'
if __name__ == '__main__':
    tree = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'
    issues = list(findings(tree))
    for path, reason in issues:
        print(f'{path}: {reason}')
    if issues:
        raise SystemExit(f'{len(issues)} candidates: review before release; never paste credentials.')
    print('Tracked-tree preflight passed. Full history scan and manual review still required.')
