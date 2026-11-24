#!/usr/bin/env python3
"""Safely propagate verified browser session avatar to desktop session.
No writes occur unless every expected code anchor is matched.
"""
from pathlib import Path
import re, sys
ROOT = Path(__file__).resolve().parents[2]
paths = {
    'pair': ROOT/'backend/src/Pakpost.Api/Security/DesktopPairingStore.cs',
    'auth': ROOT/'backend/src/Pakpost.Api/Controllers/DesktopAuthController.cs',
    'session': ROOT/'backend/src/Pakpost.Api/Security/ServerSessionStore.cs',
    'handler': ROOT/'backend/src/Pakpost.Api/Security/BrowserSessionAuthenticationHandler.cs',
}
missing=[str(p.relative_to(ROOT)) for p in paths.values() if not p.is_file()]
if missing: sys.exit('[STOP] Missing files: '+', '.join(missing))
src={k:p.read_text() for k,p in paths.items()}
out=dict(src)

def replace_once(key, pattern, replacement, flag=0):
    v,n = re.subn(pattern, replacement, out[key], count=0, flags=flag)
    if n != 1: sys.exit(f'[STOP] Unexpected {key} anchor ({n} matches): {pattern[:100]}. No files modified.')
    out[key]=v

# Preconditions on known authorization boundary; never alter it.
if 'Context.Items[typeof(BrowserSession)] = session;' not in src['handler']:
    sys.exit('[STOP] Browser session cache contract changed. No files modified.')
if 'string? AvatarUrl = null' not in src['session'] or 'avatarUrl: ' in src['session'].split('CreateAsync',1)[0]:
    sys.exit('[STOP] BrowserSession avatar contract unexpected. No files modified.')
if 'HttpContext.Items.ContainsKey("pakpost_desktop_auth")' not in src['auth']:
    sys.exit('[STOP] Browser-only approval guard missing. No files modified.')
if 'DesktopAuth:AllowedUserIds' in src['auth']:
    sys.exit('[STOP] Old allowlist controller detected. Remove/review allowlist first. No files modified.')

# Pairing should move display metadata only, not credentials, and only after approval.
if 'ApprovedAvatarUrl' not in out['pair']:
    replace_once('pair', r'(public\s+Guid\?\s+ApprovedUserId\s*\{\s*get;\s*set;\s*\})', r'\1\n        public string? ApprovedAvatarUrl { get; set; }')
if not re.search(r'public\s+bool\s+Approve\(string\s+id,\s*Guid\s+userId,\s*string\?\s+avatarUrl\s*=\s*null\)',out['pair']):
    replace_once('pair',r'public\s+bool\s+Approve\(string\s+id,\s*Guid\s+userId\)', 'public bool Approve(string id, Guid userId, string? avatarUrl = null)')
if 'p.ApprovedAvatarUrl = avatarUrl;' not in out['pair']:
    replace_once('pair',r'(p\.ApprovedUserId\s*=\s*userId\s*;)',r'\1\n            p.ApprovedAvatarUrl = avatarUrl;')
if 'out string? avatarUrl' not in out['pair']:
    replace_once('pair',r'public\s+Status\s+Consume\(string\s+id,\s*string\s+secret,\s*out\s+Guid\s+userId\)', 'public Status Consume(string id, string secret, out Guid userId, out string? avatarUrl)')
    replace_once('pair',r'(userId\s*=\s*default\s*;)',r'\1\n        avatarUrl = null;')
if 'avatarUrl = p.ApprovedAvatarUrl;' not in out['pair']:
    replace_once('pair',r'(userId\s*=\s*p\.ApprovedUserId\.Value\s*;)',r'\1\n            avatarUrl = p.ApprovedAvatarUrl;')

# Only read avatar from validated browser session stored by authentication middleware.
avatar_arg='(HttpContext.Items.TryGetValue(typeof(BrowserSession), out var bs) ? bs as BrowserSession : null)?.AvatarUrl'
if 'pairing.Approve(input.RequestId' not in out['auth']:
    sys.exit('[STOP] Approval call not found. No files modified.')
if '?.AvatarUrl' not in out['auth']:
    if 'pairing.Approve(input.RequestId, currentUserId)' in out['auth']:
        out['auth']=out['auth'].replace('pairing.Approve(input.RequestId, currentUserId)',f'pairing.Approve(input.RequestId, currentUserId, {avatar_arg})',1)
    elif 'pairing.Approve(input.RequestId, User.GetUserId())' in out['auth']:
        out['auth']=out['auth'].replace('pairing.Approve(input.RequestId, User.GetUserId())',f'pairing.Approve(input.RequestId, User.GetUserId(), {avatar_arg})',1)
    else:
        sys.exit('[STOP] Approval call structure unknown; no files modified.')
if not re.search(r'pairing\.Consume\([^;]*out\s+var\s+avatarUrl\s*\)',out['auth']):
    replace_once('auth',r'pairing\.Consume\(input\.RequestId\s*\?\?\s*"",\s*input\.DeviceSecret\s*\?\?\s*"",\s*out\s+var\s+userId\)', 'pairing.Consume(input.RequestId ?? "", input.DeviceSecret ?? "", out var userId, out var avatarUrl)')
if 'avatarUrl: avatarUrl' not in out['auth']:
    replace_once('auth',r'sessions\.CreateAsync\(userId,\s*ct,\s*"PakPost Desktop"\)', 'sessions.CreateAsync(userId, ct, "PakPost Desktop", avatarUrl: avatarUrl)')

# Final consistency checks before any writes.
if out['auth'].count('pairing.Approve(input.RequestId') != 1 or out['auth'].count('pairing.Consume(') != 1:
    sys.exit('[STOP] Unexpected pairing call counts. No files modified.')
if out['pair'].count('ApprovedAvatarUrl') != 3:
    sys.exit('[STOP] Unexpected avatar state count. No files modified.')
changed=[(paths[k],out[k]) for k in ('pair','auth') if out[k]!=src[k]]
if not changed:
    print('[OK] Already applied. No file changed.')
    sys.exit(0)
for p,content in changed:
    p.write_text(content)
    print('[PATCHED]',p.relative_to(ROOT))
print('[OK] Browser-verified avatar now propagated into desktop session. No frontend/UI changes.')
