import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectCloudItem,buildCloudDeletePayload,folderKey,requestKey} from '../../src/features/collections/services/cloudSelection.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const order=['folder:f1','request:r1','request:r2','folder:f2','request:r3'];
test('Cloud Ctrl/Meta toggle and Shift range select visible rows',()=>{
  let state=selectCloudItem([],null,'request:r1',order);
  assert.deepEqual(state.keys,['request:r1']);
  state=selectCloudItem(state.keys,state.anchor,'request:r3',order,{range:true});
  assert.deepEqual(state.keys,['request:r1','request:r2','folder:f2','request:r3']);
  state=selectCloudItem(state.keys,state.anchor,'folder:f2',order,{toggle:true});
  assert.deepEqual(state.keys,['request:r1','request:r2','request:r3']);
  assert.equal(state.anchor,'folder:f2');
});
test('invalid range falls back to single selection',()=>{
  assert.deepEqual(selectCloudItem(['folder:f1'],'missing','request:r2',order,{range:true}).keys,['request:r2']);
});
test('delete payload deduplicates and keeps optimistic folder versions',()=>{
  const result=buildCloudDeletePayload([folderKey('f1'),requestKey('r1'),requestKey('r1')],
    [{id:'f1',version:9}],[{id:'r1',folderId:'f1'}]);
  assert.deepEqual(result,{folders:[{id:'f1',version:9}],requestIds:['r1']});
});
test('delete never silently drops unknown selections',()=>{
  assert.throws(()=>buildCloudDeletePayload(['folder:missing'],[],[]),/missing/);
  assert.throws(()=>buildCloudDeletePayload([],[],[]),/between 1 and 200/);
});
test('backend commits subtree deletes once, checks permission, and emits refresh events',()=>{
  const handlers=read('../../../backend/src/Pakpost.Application/Internal/Collections/CollectionFolders.cs');
  const controller=read('../../../backend/src/Pakpost.Api/Controllers/CollectionFoldersController.cs');
  const code=handlers.slice(handlers.indexOf('public sealed class DeleteFolderItemsHandler'));
  assert.match(code,/CheckAccess\(cmd\.ActorId,cmd\.WorkspaceId,cmd\.CollectionId,true/);
  assert.match(code,/deletedFolders\.Contains\(folder\)/);
  assert.match(code,/requests\.Remove\(request\)/);
  assert.match(code,/folders\.Remove\(folder\)/);
  assert.equal((code.match(/uow\.SaveChangesAsync\(ct\)/g)||[]).length,1);
  assert.match(controller,/"folder\.deleted"/);
  assert.match(controller,/"request\.deleted"/);
});
test('Cloud editor shortcuts are scoped to the tree, not document',()=>{
  const tree=read('../../src/features/collections/components/CloudFolderTree.jsx');
  const explorer=read('../../src/features/collections/components/WorkbenchExplorer.jsx');
  assert.match(tree,/onKeyDown=\{onKeys\}/);
  assert.match(tree,/event\.key==='F2'/);
  assert.match(tree,/event\.key==='Delete'/);
  assert.match(tree,/Delete Cloud items\?/);
  assert.doesNotMatch(tree,/Root · drop here to move out of folders/);
  assert.doesNotMatch(tree,/pp-add-side/);
  assert.match(tree,/New subfolder/);
  assert.match(tree,/event\.ctrlKey\|\|event\.metaKey/);
  assert.doesNotMatch(tree,/window\.addEventListener\('keydown',onKeys\)/);
  assert.match(explorer,/onRenameRequest=/);
  assert.match(explorer,/onRefreshRequests=/);
  const menu=read('../../src/app/components/WorkbenchView.jsx');
  assert.match(menu,/\['newFolder','New folder'\]/);
});
