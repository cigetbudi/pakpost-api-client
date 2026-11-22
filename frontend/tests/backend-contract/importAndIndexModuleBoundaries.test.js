import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Cloud index reader keeps keyset paging and decrypts index only after selecting rows',()=>{
  const repository=read('../../../backend/src/Pakpost.Infrastructure/Persistence/Repositories/SavedRequestRepository.cs');
  const index=read('../../../backend/src/Pakpost.Infrastructure/Persistence/Repositories/SavedRequestIndexReader.cs');
  assert.match(repository,/SavedRequestIndexReader\.PageIndexAsync\(db/);
  assert.match(repository,/SavedRequestIndexReader\.ListIndexAsync\(db/);
  assert.match(index,/FromSqlInterpolated/);
  assert.match(index,/sorted\.Take\(size \+ 1\)/);
  assert.match(index,/DecryptRequestIndexAsync/);
  assert.doesNotMatch(index,/request\.Body|request\.PreRequestScript|request\.PostResponseScript/);
  assert.match(index,/\\\\%/); // SQL ILIKE literal metacharacters must be escaped
});

test('Cloud import validates all inputs and still commits exactly once',()=>{
  const handler=read('../../../backend/src/Pakpost.Application/Internal/Collections/Handlers/ImportCollectionsHandler.cs');
  const guard=read('../../../backend/src/Pakpost.Application/Internal/Collections/Services/CloudImportGuard.cs');
  const folder=read('../../../backend/src/Pakpost.Application/Internal/Collections/Services/ImportedFolderPathResolver.cs');
  assert.match(handler,/WorkspacePermissions\.RequireAsync/);
  assert.match(handler,/CloudImportGuard\.ValidateBatch\(command\)/);
  assert.match(handler,/CloudImportGuard\.ValidateRequest/);
  assert.match(handler,/SavedRequestHistoryCodec\.Capture/);
  assert.equal((handler.match(/unitOfWork\.SaveChangesAsync/g)||[]).length,1);
  assert.match(guard,/Cloud import limits exceeded \(30 collections, 200 requests\)/);
  assert.match(guard,/SavedHeaderPolicy\.EnsureSafe/);
  assert.match(folder,/Folder limit: 500 per collection/);
  assert.match(folder,/Imported folder depth exceeds 24/);
  assert.match(folder,/StringComparer\.OrdinalIgnoreCase/);
});
