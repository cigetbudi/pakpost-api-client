import { readWorkbenchSource } from '../support/workbenchSource.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decideCloudTabSync,conflictFields} from '../../src/features/requests/services/cloudConflict.js';
import {validWorkspaceEvent,shouldRefreshRequestList} from '../../src/features/realtime/services/workspaceRealtime.js';
import {requestFingerprint} from '../../src/features/requests/services/draftLifecycle.js';
const root=new URL('../../../',import.meta.url);
const source=(file)=>readFileSync(new URL(file,root),'utf8');
const ws='11111111-1111-1111-1111-111111111111',collection='22222222-2222-2222-2222-222222222222';
const item={id:'33333333-3333-3333-3333-333333333333',revision:2};
const draft={method:'POST',url:'https://example.test/api',body:'{}'};
function tab(revision=1){return {name:'InquiryAccount',savedName:'InquiryAccount',savedFingerprint:requestFingerprint(draft,'InquiryAccount'),source:{scope:'workspace',workspaceId:ws,collectionId:collection,requestId:item.id,revision}};}
test('clean open Cloud tab may auto-refresh to newer revision',()=>{
 assert.equal(decideCloudTabSync(tab(1),draft,item),'reload');
 assert.equal(decideCloudTabSync(tab(2),draft,item),'none');
});
test('dirty tab is never overwritten by remote revision',()=>{
 assert.equal(decideCloudTabSync(tab(1),{...draft,body:'{"locallyEdited":true}'},item),'conflict');
 assert.equal(decideCloudTabSync(tab(1),{...draft,body:'changed'},null),'deleted');
});
test('missing revision refuses silent overwrite of unsaved draft',()=>{
 assert.equal(decideCloudTabSync(tab(undefined),{...draft,body:'edited'},item),'conflict');
});
test('other scope and stale/out-of-order event are ignored',()=>{
 assert.equal(decideCloudTabSync({...tab(),source:{...tab().source,scope:'local'}},draft,item),'none');
 assert.equal(decideCloudTabSync(tab(4),draft,item),'none');
});
test('comparison exposes only field names and equality not secret contents',()=>{
 const result=conflictFields({body:'secret-one',url:'url1'},{body:'secret-two',url:'url1'});
 assert.equal(result.find(x=>x.field==='Body').same,false);
 assert.equal(result.find(x=>x.field==='URL').same,true);
 assert.ok(!JSON.stringify(result).includes('secret-'));
});
test('workspace events require matching IDs and known kind',()=>{
 const valid={workspaceId:ws,kind:'request.updated',collectionId:collection,requestId:item.id};
 assert.equal(validWorkspaceEvent(valid,ws),true);
 assert.equal(validWorkspaceEvent(valid,'44444444-4444-4444-4444-444444444444'),false);
 assert.equal(validWorkspaceEvent({...valid,kind:'exfiltrate'},ws),false);
 assert.equal(validWorkspaceEvent({...valid,collectionId:'bad'},ws),false);
});
test('sidebar re-fetch only when relevant; hidden collection stays lazy',()=>{
 const event={kind:'request.created',collectionId:collection};
 assert.equal(shouldRefreshRequestList(event,{selectedCol:'other',cached:false,expanded:false}),false);
 assert.equal(shouldRefreshRequestList(event,{hasOpenTab:true}),true);
 assert.equal(shouldRefreshRequestList(event,{selectedCol:collection}),true);
});
test('backend enforces revisions even if realtime connection is absent',()=>{
 const entity=source('backend/src/Pakpost.Domain/Entities/SavedRequest.cs');
 const config=source('backend/src/Pakpost.Infrastructure/Persistence/Configurations/SavedRequestConfiguration.cs');
 const app=source('backend/src/Pakpost.Application/Internal/Collections/Handlers/UpdateSavedRequestHandler.cs');
 assert.match(entity,/Revision\+\+/);
 assert.match(config,/\.IsConcurrencyToken\(\)/);
 assert.match(app,/ExpectedRevision is null/);
 assert.match(app,/item\.Revision\s*!=\s*cmd\.ExpectedRevision\.Value/);
 assert.match(source('backend/src/Pakpost.Infrastructure/Persistence/Migrations/20261117130000_RequestRevision.cs'),/20261117130000_RequestRevision/);
});
test('SignalR group requires membership and events contain identifiers only',()=>{
 const hub=source('backend/src/Pakpost.Api/Realtime/WorkspaceHub.cs');
 const publisher=source('backend/src/Pakpost.Api/Realtime/WorkspaceChangePublisher.cs');
 assert.match(hub,/\[Authorize\]/);
 assert.match(hub,/WorkspacePermissions.RequireAsync/);
 assert.match(hub,/WorkspacePermissions.CollectionRead/);
 assert.match(publisher,/new\s*\{\s*workspaceId,kind,collectionId,requestId,revision,sourceInstance/);
 assert.doesNotMatch(publisher,/body\s*=/i);
});
test('UI has conflict warning and Ctrl+S guards and keeps Console lazy',()=>{
 const app=readWorkbenchSource();
 const vite=source('frontend/vite.config.js');
 assert.match(app,/if\(remoteAlerts\[tabId\]\)\{showConflictDialog\(tabId\);return;\}/);
 assert.match(app,/error.status===409\|\|error.status===428/);
 assert.match(app,/Save as Local Copy/);
 assert.match(app,/Discard draft & reload Cloud/);
 assert.match(app,/const PakpostConsole = lazy/);
 assert.ok(vite.includes("'/hubs'")); // Vite routes websocket to backend
});
