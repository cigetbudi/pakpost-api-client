import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('Local collection recursion stays separate from menu and storage state', () => {
  const tree = source('../../src/features/collections/components/LocalCollectionsTree.jsx');
  const branch = source('../../src/features/collections/components/LocalCollectionBranch.jsx');
  assert.match(tree, /import \{LocalCollectionBranch\}/);
  assert.match(tree, /<LocalCollectionBranch/);
  assert.match(branch, /export function LocalCollectionBranch\(/);
  assert.match(branch, /onMove\(e,collectionId,path,r\.id,dragRowPlacement\(e\)\)/);
  assert.match(branch, /pp-unsaved-dot/);
  assert.doesNotMatch(branch, /useEffect\(|localStorage\.|fetch\(/);
});

test('Cloud recursive renderer keeps drop events and paged request rows', () => {
  const owner = source('../../src/features/collections/components/CloudFolderTree.jsx');
  const renderer = source('../../src/features/collections/components/renderCloudFolderNodes.jsx');
  assert.match(owner, /renderCloudFolderNodes\(branch,depth,/);
  assert.match(renderer, /folderMove\(e,folder\.id\)/);
  assert.match(renderer, /<CloudPagedRequestRows/);
  assert.match(renderer, /<CloudRequestRows/);
  assert.match(renderer, /renderCloudFolderNodes\(folder,depth\+1,ctx\)/);
  assert.doesNotMatch(renderer, /useEffect\(|fetch\(|api\(/);
});

test('dialog composition retains all four separate workflows', () => {
  const composition = source('../../src/features/requests/components/RequestDialogs.jsx');
  for (const name of ['UnsavedChangesDialog', 'SaveResponseExampleDialog', 'RequestRevisionDialogs', 'RequestStorageDialogs']) {
    assert.match(composition, new RegExp(`<${name} \\{\\.\\.\\.props\\}`));
  }
  const revisions = source('../../src/features/requests/components/RequestRevisionDialogs.jsx');
  const storage = source('../../src/features/requests/components/RequestStorageDialogs.jsx');
  assert.match(revisions, /Save as Local Copy/);
  assert.match(revisions, /Force Overwrite remains unavailable/);
  assert.match(storage, /ImportDestinationPicker/);
  assert.match(storage, /renameActionError/);
});

test('browser session and Google badge effects are isolated without exposing bearer tokens', () => {
  const controller = source('../../src/app/hooks/useWorkbenchController.jsx');
  const session = source('../../src/features/auth/hooks/useGoogleConnectionStatus.js');
  const notice = source('../../src/app/hooks/useWorkbenchNoticeTimeout.js');
  assert.match(controller, /useGoogleConnectionStatus\(/);
  assert.match(controller, /useWorkbenchNoticeTimeout\(/);
  assert.match(session, /\/api\/auth\/google\/status/);
  assert.match(session, /if\(active\)/);
  assert.doesNotMatch(session, /sessionStorage|localStorage|Authorization:|setToken/);
  assert.match(notice, /clearTimeout\(timer\)/);
});
