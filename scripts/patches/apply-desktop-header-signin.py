#!/usr/bin/env python3
"""Patch the current PakPost repo in place without overwriting later D5 work."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
header = root / 'frontend/src/components/layout/AppHeader.jsx'
view = root / 'frontend/src/app/components/WorkbenchView.jsx'

for path in (header, view):
    if not path.is_file():
        sys.exit(f'[ERROR] Missing {path}; run from PakPost repository root.')

old_header = header.read_text(encoding='utf-8')
old_view = view.read_text(encoding='utf-8')
new_header = old_header
new_view = old_view

import_stmt = "import {isTauriDesktop} from '../../features/collections/services/desktopLocalRepository.js';"
if import_stmt not in new_header:
    anchor = "import {ProfileMenu} from './ProfileMenu.jsx';"
    if new_header.count(anchor) != 1:
        sys.exit('[ERROR] AppHeader import anchor changed. No files modified.')
    new_header = new_header.replace(anchor, anchor + '\n' + import_stmt, 1)

# Keep web behavior intact; in Tauri route the login button to Settings > Desktop connections.
old_button = '<button className="pp-signin" onClick={() => setAuthOpen(true)}><LogIn size={15}/> Sign in</button>'
new_button = """<button className="pp-signin" onClick={() => {
              if (isTauriDesktop()) {
                setSettingsCategory('connections');
                setPage('settings');
              } else {
                setAuthOpen(true);
              }
            }}><LogIn size={15}/> Sign in</button>"""
if old_button in new_header:
    if new_header.count(old_button) != 1:
        sys.exit('[ERROR] Unexpected multiple header Sign in buttons. No files modified.')
    new_header = new_header.replace(old_button, new_button, 1)
elif "setSettingsCategory('connections')" not in new_header:
    sys.exit('[ERROR] AppHeader Sign in code changed. No files modified.')

old_props = 'theme, token, updateStorageScope, workspaces, onOpenSecurity,'
new_props = 'theme, token, updateStorageScope, workspaces, setPage, setSettingsCategory, onOpenSecurity,'
if old_props in new_header:
    new_header = new_header.replace(old_props, new_props, 1)
elif new_props not in new_header:
    sys.exit('[ERROR] AppHeader prop destructuring changed. No files modified.')

old_pass = 'updateStorageScope, workspaces,\n        onOpenSecurity:'
new_pass = 'updateStorageScope, workspaces, setPage, setSettingsCategory,\n        onOpenSecurity:'
if old_pass in new_view:
    new_view = new_view.replace(old_pass, new_pass, 1)
elif new_pass not in new_view:
    sys.exit('[ERROR] WorkbenchView AppHeader props changed. No files modified.')

if new_header == old_header and new_view == old_view:
    print('[OK] Already patched; no changes needed.')
    sys.exit(0)

# Validate both transformations before changing either file, preventing partial patches.
if not all([
    import_stmt in new_header,
    "setSettingsCategory('connections')" in new_header,
    new_props in new_header,
    new_pass in new_view,
]):
    sys.exit('[ERROR] Patch verification failed. No files modified.')

if new_header != old_header:
    header.write_text(new_header, encoding='utf-8')
    print('[PATCHED] frontend/src/components/layout/AppHeader.jsx')
if new_view != old_view:
    view.write_text(new_view, encoding='utf-8')
    print('[PATCHED] frontend/src/app/components/WorkbenchView.jsx')
print('[OK] Desktop header Sign in now opens Settings > Desktop connections. Web Sign in unchanged.')
