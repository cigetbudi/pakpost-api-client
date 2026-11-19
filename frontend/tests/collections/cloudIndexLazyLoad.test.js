import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getWorkspaceRequests,workspaceRequestsPath} from '../../src/features/collections/services/workspaceRequestRepository.js';

const read=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');

test('Explorer fetches only request index while preserving full list for export and runner',()=>{
  const workbench=read('../../src/app/hooks/useWorkbenchController.jsx');
  const controller=read('../../../backend/src/Pakpost.Api/Controllers/SavedRequestsController.cs');
  assert.match(workbench,/collections\/\$\{selectedCol\}\/requests\/index/);
  assert.match(workbench,/collections\/\$\{col\.id\}\/requests\/index/);
  assert.match(controller,/\[HttpGet\("index"\)\]/);
  assert.match(controller,/\[HttpGet\("\{requestId:guid\}"\)\]/);
  assert.match(controller,/new ListSavedRequestsQuery/);
  assert.match(workspaceRequestsPath('ws','col'),/\/requests$/);
});

test('opening an indexed request hydrates detail and ignores stale workspace responses',()=>{
  const source=read('../../src/app/hooks/useWorkbenchController.jsx');
  assert.match(source,/if \(!item\?\.isIndex\).*tabActions\.loadSavedRequest\(item\)/);
  assert.match(source,/requests\/\$\{item\.id\}`,'GET'/);
  assert.match(source,/selection!==cloudOpenEpoch\.current/);
  const actions=read('../../src/features/collections/controllers/createCollectionActions.js');
  assert.match(actions,/item\.isIndex\s*\?await api\(`/);
});

test('saved request refresh uses index rather than full payload',()=>{
  const repo=read('../../src/features/collections/services/workspaceRequestRepository.js');
  assert.match(repo,/workspaceRequestsPath\(workspaceId, collectionId\)\}\/index/);
});
