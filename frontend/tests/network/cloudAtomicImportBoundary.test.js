import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');

test('Cloud import backend checks permission and uses one SaveChanges transaction boundary',()=>{
  const source=read('../../../backend/src/Pakpost.Application/Internal/Collections/Handlers/ImportCollectionsHandler.cs');
  const controller=read('../../../backend/src/Pakpost.Api/Controllers/CollectionsController.cs');
  assert.match(controller,/HttpPost\("import"\)/);
  assert.match(source,/WorkspacePermissions\.CollectionWrite/);
  assert.match(source,/SavedHeaderPolicy\.EnsureSafe/);
  assert.match(source,/new SaveRequestValidator\(\)/);
  assert.match(source,/new SaveCollectionVariablesValidator\(\)/);
  assert.match(source,/SavedRequestHistoryCodec\.Capture/);
  assert.match(source,/cipher/);
  assert.equal((source.match(/uow\.SaveChangesAsync\(ct\)/g)||[]).length,1);
});

test('Cloud import enforces collection limits and never falls back to per-item API writes',()=>{
  const source=read('../../src/features/import-export/services/storageScope.js');
  assert.match(source,/sources\.length<1\|\|sources\.length>30/);
  assert.match(source,/\$\{base\}\/import/);
  assert.doesNotMatch(source,/\$\{base\}\/\$\{created\.id\}\/requests/);
  assert.match(source,/Refresh Cloud before retrying/);
});
