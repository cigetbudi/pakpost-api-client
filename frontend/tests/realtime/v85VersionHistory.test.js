import { readWorkbenchSource } from '../support/workbenchSource.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareRequestVersions,applyFieldMerge,safeVersionSummary} from '../../src/features/requests/services/requestVersionMerge.js';
const root=new URL('../../../',import.meta.url);
const source=(path)=>readFileSync(new URL(path,root),'utf8');
test('three-way merge marks simultaneous edits as conflicts and preserves untouched fields',()=>{
 const base={name:'Inquiry',method:'POST',url:'https://local.test',body:'{"ref":1}'};
 const ours={...base,url:'https://my-test.test',body:'{"ref":2}'};
 const theirs={...base,url:'https://dev.test',method:'GET'};
 const compared=compareRequestVersions(ours,theirs,base);
 assert.equal(compared.find(x=>x.key==='url').conflict,true);
 assert.equal(compared.find(x=>x.key==='method').suggestedCloud,true);
 assert.equal(compared.find(x=>x.key==='body').yourChange,true);
 assert.equal(compared.find(x=>x.key==='body').cloudChange,false);
});
test('selected merge never overwrites unselected local script, auth or body',()=>{
 const ours={name:'local',body:'my secret',preScript:'console.log("my code")',method:'POST',authType:'bearer',bearerToken:'my token'};
 const theirs={name:'remote',body:'other secret',preScript:'remote',method:'GET',authType:'basic',bearerToken:'other'};
 const result=applyFieldMerge(ours,theirs,['method','name']);
 assert.equal(result.name,'remote');assert.equal(result.method,'GET');
 assert.equal(result.body,ours.body);assert.equal(result.preScript,ours.preScript);
 assert.equal(result.bearerToken,'my token');
 assert.deepEqual(ours,{name:'local',body:'my secret',preScript:'console.log("my code")',method:'POST',authType:'bearer',bearerToken:'my token'});
});
test('auth merge is grouped and the unsafe fields have no value preview',()=>{
 const local={authType:'bearer',bearerToken:'old',basicPassword:'keep'};
 const remote={authType:'basic',bearerToken:'new',basicPassword:'secret'};
 const merged=applyFieldMerge(local,remote,['auth']);
 assert.equal(merged.authType,'basic');assert.equal(merged.basicPassword,'secret');
 assert.ok(!safeVersionSummary('auth','token-very-secret').includes('token-very-secret'));
 assert.ok(!safeVersionSummary('body','password-very-secret').includes('password-very-secret'));
 assert.ok(!safeVersionSummary('url','https://url.test?token=secret').includes('secret'));
 assert.ok(!safeVersionSummary('preScript','var key="secret"').includes('secret'));
});
test('history model is immutable and encrypted, not plaintext in table',()=>{
 const entity=source('backend/src/Pakpost.Domain/Entities/SavedRequestRevision.cs');
 const codec = [
  'Services/SavedRequestHistoryCodec.cs',
  'Handlers/RestoreSavedRequestHistoryHandler.cs',
  'Services/SavedRequestHistoryAccess.cs'
 ].map(file => source(`backend/src/Pakpost.Application/Internal/Collections/${file}`)).join('\n');
 const model=source('backend/src/Pakpost.Infrastructure/Persistence/Configurations/SavedRequestRevisionConfiguration.cs');
 assert.match(codec,/cipher\.Protect\(JsonSerializer\.Serialize\(snapshot\)\)/);
 assert.match(codec,/cipher\.Unprotect\(revision\.EncryptedSnapshot\)/);
 assert.match(entity,/EncryptedSnapshot/);assert.match(model,/encrypted_snapshot/);
 assert.match(codec,/ExpectedRevision/);assert.match(codec,/item\.Revision\s*!=\s*c\.ExpectedRevision/);
 assert.match(codec,/WorkspacePermissions.CollectionWrite/);
});
test('create, update and restore append version snapshots in a database transaction',()=>{
 const handlers = [
  'Handlers/SaveRequestHandler.cs',
  'Handlers/UpdateSavedRequestHandler.cs'
 ].map(file => source(`backend/src/Pakpost.Application/Internal/Collections/${file}`)).join('\n');
 const history=source('backend/src/Pakpost.Application/Internal/Collections/Handlers/RestoreSavedRequestHistoryHandler.cs');
 const controller=source('backend/src/Pakpost.Api/Controllers/SavedRequestsController.cs');
 assert.match(handlers,/history\.Add\(SavedRequestHistoryCodec\.Capture\(item,\s*c\.ActorId,\s*"created",\s*cipher\)\)/);
 assert.match(handlers,/history\.Add\(SavedRequestHistoryCodec\.Capture\(item,\s*cmd\.ActorId,\s*"updated",\s*cipher\)\)/);
 assert.match(history,/history\.Add\(SavedRequestHistoryCodec\.Capture\(item,\s*c\.ActorId,\s*"restored",\s*cipher\)\)/);
 assert.match(history,/await uow.SaveChangesAsync\(ct\)/);
 assert.match(controller,/history\/\{revision:int\}\/restore/);
 assert.match(controller,/realtime.PublishAsync\(workspaceId,"request.updated"/);
});
test('frontend uses lazy version panel and requires explicit apply/restore',()=>{
 const app=readWorkbenchSource();const history=source('frontend/src/features/requests/controllers/createRequestHistoryActions.js');const panel=source('frontend/src/features/requests/components/RequestRevisionPanel.jsx');
 assert.match(app,/RequestRevisionPanel = lazy/);
 assert.match(app,/applyMergedRevision/);
 assert.match(app,/createRequestHistoryActions/);
 assert.match(history,/expectedRevision/);
 assert.match(panel,/Apply selected fields to draft/);
 assert.match(panel,/restoreConfirmed/);
 assert.match(panel,/Nothing is saved automatically/);
});
