#!/usr/bin/env python3
"""PakPost D5: propagate Google avatar to device session, align desktop account UI.
Applies surgically and refuses unknown code; no backups/secrets bundled.
"""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[2]
paths={
 'pair':root/'backend/src/Pakpost.Api/Security/DesktopPairingStore.cs',
 'auth':root/'backend/src/Pakpost.Api/Controllers/DesktopAuthController.cs',
 'header':root/'frontend/src/components/layout/AppHeader.jsx',
 'menu':root/'frontend/src/components/layout/ProfileMenu.jsx',
 'connect':root/'frontend/src/features/desktop/components/DesktopConnections.jsx',
}
if not all(p.is_file() for p in paths.values()):
 sys.exit('Missing files: '+', '.join(str(p) for p in paths.values() if not p.is_file()))
original={k:p.read_text() for k,p in paths.items()}
changes=original.copy()
def change(k,a,b):
 s=changes[k]
 if b in s: return
 if s.count(a)!=1: sys.exit(f'[STOP] Unexpected {k} anchor ({s.count(a)} matches). No files modified.')
 changes[k]=s.replace(a,b,1)
# Persist avatar URL only inside short-lived pending pairing state, same host and user.
change('pair','public Guid? ApprovedUserId { get; set; }','public Guid? ApprovedUserId { get; set; }\n        public string? ApprovedAvatarUrl { get; set; }')
change('pair','public bool Approve(string id, Guid userId)','public bool Approve(string id, Guid userId, string? avatarUrl = null)')
change('pair','p.ApprovedUserId = userId;\n            return true;','p.ApprovedUserId = userId;\n            // Avatar is display-only metadata from the verified browser session.\n            p.ApprovedAvatarUrl = avatarUrl;\n            return true;')
change('pair','public Status Consume(string id, string secret, out Guid userId)\n    {\n        userId = default;','public Status Consume(string id, string secret, out Guid userId, out string? avatarUrl)\n    {\n        userId = default;\n        avatarUrl = null;')
change('pair','userId = p.ApprovedUserId.Value;\n            p.Consumed = true;','userId = p.ApprovedUserId.Value;\n            avatarUrl = p.ApprovedAvatarUrl;\n            p.Consumed = true;')
# Only browser session can approve; use that session's avatar, not client-supplied input.
change('auth','pairing.Approve(input.RequestId, currentUserId)','pairing.Approve(input.RequestId, currentUserId, (HttpContext.Items.TryGetValue(typeof(BrowserSession), out var browserSession) ? browserSession as BrowserSession : null)?.AvatarUrl)') if 'currentUserId' in changes['auth'] else change('auth','pairing.Approve(input.RequestId, User.GetUserId())','pairing.Approve(input.RequestId, User.GetUserId(), (HttpContext.Items.TryGetValue(typeof(BrowserSession), out var browserSession) ? browserSession as BrowserSession : null)?.AvatarUrl)')
change('auth','pairing.Consume(input.RequestId ?? "", input.DeviceSecret ?? "", out var userId)','pairing.Consume(input.RequestId ?? "", input.DeviceSecret ?? "", out var userId, out var avatarUrl)')
change('auth','sessions.CreateAsync(userId, ct, "PakPost Desktop")','sessions.CreateAsync(userId, ct, "PakPost Desktop", avatarUrl: avatarUrl)')
# Header status avoids claiming Local development while connected remotely.
change('header','<span className="pp-connection"><span/> Local development</span>', '''<span className="pp-connection" title={isTauriDesktop() ? (token ? 'Authenticated desktop session' : 'Local desktop or disconnected remote profile') : 'Web application'}><span/> {isTauriDesktop() ? (token ? 'Desktop · Connected' : 'Desktop · Not connected') : 'Local development'}</span>''')
# Keep prior header sign-in patch, don't accidentally re-enable embedded OAuth.
if "setSettingsCategory('connections')" not in changes['header']:
 sys.exit('[STOP] Prior desktop header Sign in fix is missing. Apply previous fix first. No files modified.')
# Signout confirmation reflects remote session, not browser cookie.
change('menu',"import {safeGoogleAvatar} from '../../features/auth/services/googleAvatar.js';","import {safeGoogleAvatar} from '../../features/auth/services/googleAvatar.js';\nimport {isTauriDesktop} from '../../features/collections/services/desktopLocalRepository.js';")
change('menu','Your server session on this browser will be revoked. Local collections and unsaved local drafts stay on this device.','{isTauriDesktop() ? \'Your selected desktop server session will be revoked. Local collections and drafts stay on this device.\' : \'Your server session on this browser will be revoked. Local collections and unsaved local drafts stay on this device.\'}')
# Connection manager makes selected profile state explicit, even without a token.
change('connect',"<strong>{p.name}{p.id===store.activeId?' · Selected':''}</strong><small>{p.kind==='local'?'Offline · SQLite':p.url}</small>","<strong>{p.name}{p.id===store.activeId?(p.kind==='local'?' · Active (offline)':connected?' · Connected':' · Selected (signed out)'):''}</strong><small>{p.kind==='local'?'Offline · SQLite':p.url}</small>")
change('connect',"{pairing&&<p role=\"status\">Waiting for browser approval…", "{connected&&store.activeId!=='local'&&<p role=\"status\">Connected to the selected PakPost server. To sign out, use your account menu in the top-right corner.</p>}\n    {pairing&&<p role=\"status\">Waiting for browser approval…")
# Update all changed files only once, after all anchors validated.
for k,p in paths.items():
 if changes[k]!=original[k]:
  p.write_text(changes[k]); print('[PATCHED]',p.relative_to(root))
print('[OK] Avatar is carried from the verified browser session into its desktop session; account labels updated.')
