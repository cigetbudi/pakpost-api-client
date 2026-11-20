import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyLocalAction} from '../../src/features/collections/services/localCollectionActions.js';
import {cloudVirtualWindow,CLOUD_SERVER_PAGING_THRESHOLD,CLOUD_SERVER_PAGE_SIZE} from '../../src/features/collections/services/cloudRenderBudget.js';
import {getWorkspaceRequestIndexPage} from '../../src/features/collections/services/workspaceRequestRepository.js';
import {withCloudPageSlot} from '../../src/features/collections/services/cloudPageQueue.js';
const source=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const make=()=>[{
  id:'collection-1',name:'Collection',folderDocs:{'["A"]':'parent docs','["A","Inner"]':'child docs','["B"]':'B docs'},
  requests:[
    {id:'one',name:'one',folderPath:['A'],responseExamples:[]},
    {id:'two',name:'two',folderPath:['A','Inner'],responseExamples:[]},
    {id:'three',name:'three',folderPath:['B'],responseExamples:[]}
  ]
}];

test('Local folder move rewrites nested request paths and documentation',()=>{
  const before=make();
  const after=applyLocalAction(before,{type:'moveFolder',collectionId:'collection-1',
    folderPath:['A'],targetCollectionId:'collection-1',targetFolderPath:['B']});
  assert.deepEqual(after[0].requests[0].folderPath,['B','A']);
  assert.deepEqual(after[0].requests[1].folderPath,['B','A','Inner']);
  assert.deepEqual(after[0].requests[2].folderPath,['B']);
  assert.equal(after[0].folderDocs['["B","A"]'],'parent docs');
  assert.equal(after[0].folderDocs['["B","A","Inner"]'],'child docs');
  assert.deepEqual(before[0].requests[0].folderPath,['A']);
  assert.equal(before[0].folderDocs['["A"]'],'parent docs');
});
test('Local folder can leave a parent and return to Collection root',()=>{
  const nested=applyLocalAction(make(),{type:'moveFolder',collectionId:'collection-1',
    folderPath:['A'],targetCollectionId:'collection-1',targetFolderPath:['B']});
  const root=applyLocalAction(nested,{type:'moveFolder',collectionId:'collection-1',
    folderPath:['B','A'],targetCollectionId:'collection-1',targetFolderPath:[]});
  assert.deepEqual(root[0].requests[1].folderPath,['A','Inner']);
  assert.equal(root[0].folderDocs['["A"]'],'parent docs');
});
test('Local folder rejects cycles, sibling collisions, and moving between collections',()=>{
  assert.throws(()=>applyLocalAction(make(),{type:'moveFolder',collectionId:'collection-1',folderPath:['A'],targetFolderPath:['A','Inner']}),/descendants/);
  assert.throws(()=>applyLocalAction(make(),{type:'moveFolder',collectionId:'collection-1',folderPath:['A','Inner'],targetFolderPath:['A','Inner']}),/descendants/);
  const collided=make();collided[0].requests.push({id:'four',name:'four',folderPath:['Inner'],responseExamples:[]});
  assert.throws(()=>applyLocalAction(collided,{type:'moveFolder',collectionId:'collection-1',folderPath:['A','Inner'],targetFolderPath:[]}),/already exists/);
  assert.throws(()=>applyLocalAction(make(),{type:'moveFolder',collectionId:'collection-1',folderPath:['A'],targetCollectionId:'other',targetFolderPath:[]}),/Destination collection/);
});
test('Cloud page uses keyset bounds and keeps existing full index for export',()=>{
  const api=source('../../src/features/collections/services/workspaceRequestRepository.js');
  assert.match(api,/index\/page\?/);
  assert.match(api,/index`, 'GET'/);
  assert.equal(CLOUD_SERVER_PAGING_THRESHOLD,800);
  assert.equal(CLOUD_SERVER_PAGE_SIZE,120);
  const backend=source('../../../backend/src/Pakpost.Infrastructure/Persistence/Repositories/SavedRequestRepository.cs');
  assert.match(backend,/FromSqlInterpolated/);
  assert.match(backend,/sorted\.Take\(size \+ 1\)/);
  assert.doesNotMatch(backend.slice(backend.indexOf('PageIndexAsync'),backend.indexOf('public async Task<IReadOnlyList<SavedRequest>> ListAsync')),/request\.Body/);
  const handler=source('../../../backend/src/Pakpost.Application/Internal/Collections/Handlers/PageSavedRequestIndexHandler.cs');
  assert.match(handler,/SavedRequestsAccess\.Check/);
  assert.match(handler,/is < 1 or > 200/);
});
test('virtual list bounds DOM rows at viewport plus overscan regardless of 50K items',()=>{
  const first=cloudVirtualWindow(50000,0,560);
  assert.deepEqual(first,{start:0,end:30,top:0,bottom:49970*28});
  const deep=cloudVirtualWindow(50000,28000,560);
  assert.ok(deep.end-deep.start<=60);
  assert.equal(deep.top,deep.start*28);
  assert.equal(deep.bottom,(50000-deep.end)*28);
  const last=cloudVirtualWindow(50000,1400000,560);
  assert.equal(last.end,50000);
});
test('DND includes folder drag MIME and root drop routing for Local and Cloud',()=>{
  const local=source('../../src/features/collections/components/LocalCollectionsTree.jsx');
  const cloud=source('../../src/features/collections/components/CloudFolderTree.jsx');
  const explorer=source('../../src/features/collections/components/WorkbenchExplorer.jsx');
  assert.match(local,/application\/x-pakpost-local-folder/);
  assert.match(local,/onMoveFolder/);
  assert.match(local,/onMove\(e,collectionId,folderPath\)/);
  assert.match(cloud,/pakpost:cloud-folder-drop-root/);
  assert.match(explorer,/CLOUD_FOLDER_DRAG/);
  assert.match(explorer,/pakpost:cloud-folder-drop-root/);
});

test('request page queue caps concurrent fetches at three',async()=>{
  let running=0,peak=0;
  const jobs=Array.from({length:12},(_,index)=>withCloudPageSlot(async()=>{
    running++;peak=Math.max(peak,running);
    await new Promise(resolve=>setTimeout(resolve,3));
    running--;return index;
  }));
  assert.deepEqual(await Promise.all(jobs),Array.from({length:12},(_,i)=>i));
  assert.equal(peak,3);
});
test('cancelled queued page does not execute stale request',async()=>{
  const hold=[];
  const first=Array.from({length:3},()=>withCloudPageSlot(()=>new Promise(resolve=>hold.push(resolve))));
  const abort=new AbortController();
  let executed=false;
  const pending=withCloudPageSlot(()=>{executed=true;return 1;},abort.signal);
  abort.abort();
  await assert.rejects(pending,{name:'AbortError'});
  hold.forEach(resolve=>resolve('done'));
  await Promise.all(first);
  assert.equal(executed,false);
});
