import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('unregistered users can be invited only via explicit instance admin flow', () => {
  const admin = src('../../src/features/settings/components/InstanceAdminPanel.jsx');
  assert.match(admin, /canInvite = !isPublic && !loading && total === 0 && isEmail\(appliedQuery\)/);
  assert.match(admin, /Invite via email/);
  assert.match(admin, /creator-invitations/);
  assert.match(admin, /Resend/);
  assert.match(admin, /Revoke/);
});

test('creator invite acceptance is separated from workspace-member invitations', () => {
  const overlay = src('../../src/features/auth/components/PlatformCreatorInvitationOverlay.jsx');
  const service = src('../../../backend/src/Pakpost.Api/Controllers/PlatformCreatorInvitationAcceptanceController.cs');
  assert.match(overlay, /creatorInvite/);
  assert.match(overlay, /Continue with Google/);
  assert.match(overlay, /creator-invitations\/accept/);
  assert.match(service, /UserExternalIdentities/);
  assert.match(service, /Provider == "google"/);
  assert.match(service, /ExecuteUpdateAsync/);
  assert.doesNotMatch(service, /WorkspaceMembers\.Add|AddMember\(/);
});
