import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url),'utf8');

test('session bootstrap is isolated from editor state and never broadcasts tokens',()=>{
  const bootstrap=read('src/features/auth/hooks/useBrowserSessionBootstrap.js');
  const controller=read('src/app/hooks/useWorkbenchController.jsx');
  assert.match(controller,/useBrowserSessionBootstrap\(\{/);
  assert.match(bootstrap,/api\('\/api\/auth\/session'/);
  assert.match(bootstrap,/readWorkspaceViewPreference/);
  assert.doesNotMatch(bootstrap,/session-response|accessToken|localStorage\.setItem/);
  assert.match(bootstrap,/authEpochRef\.current/);
});

test('cloud hydration uses workspace epochs and paged collection budget',()=>{
  const cloud=read('src/features/collections/hooks/useCloudCollectionLifecycle.js');
  assert.match(cloud,/workspaceFetchEpoch\.current/);
  assert.match(cloud,/CLOUD_SERVER_PAGING_THRESHOLD/);
  assert.match(cloud,/workspaceRequestsPending\.current/);
});

test('interceptor host discovery stays origin-bound and excludes user credentials',()=>{
  const intercept=read('src/features/requests/hooks/useInterceptorLifecycle.js');
  assert.match(intercept,/event\.origin!==window\.location\.origin/);
  assert.match(intercept,/discoverApiDestinations/);
  assert.doesNotMatch(intercept,/currentTokenRef|bearerToken|googleLinkPassword/);
});

test('collection mutations delegate to dedicated dialog and example actions',()=>{
  const collection=read('src/features/collections/controllers/createCollectionActions.js');
  const example=read('src/features/collections/controllers/createCollectionExampleActions.js');
  const dialog=read('src/features/collections/controllers/createCollectionDialogActions.js');
  assert.match(collection,/createCollectionExampleActions\(/);
  assert.match(collection,/createCollectionDialogActions\(/);
  assert.match(example,/synchronizeSavedExamples/);
  assert.match(dialog,/renameActionError/);
  const menu=read('src/features/collections/controllers/createWorkspaceCollectionMenuActions.js');
  assert.match(menu,/folderPathForId/);
  assert.match(menu,/createCollectionDraft/);
});

test('proxy SSRF rules and invitation link validation stay in dedicated backend modules',()=>{
  const runner=read('../backend/src/Pakpost.Infrastructure/Services/SafeHttpRequestRunner.cs');
  const policy=read('../backend/src/Pakpost.Infrastructure/Services/ProxyAddressPolicy.cs');
  const invitations=read('../backend/src/Pakpost.Api/Security/PlatformCreatorInvitationTokens.cs');
  assert.match(runner,/ProxyAddressPolicy\.IsPublic/);
  assert.match(policy,/IsIPv4MappedToIPv6/);
  assert.match(policy,/IPAddress\.IsLoopback/);
  assert.match(invitations,/RandomNumberGenerator\.GetBytes\(32\)/);
  assert.match(invitations,/UriSchemeHttps/);
});
