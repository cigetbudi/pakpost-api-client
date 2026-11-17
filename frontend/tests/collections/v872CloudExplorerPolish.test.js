import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeCloudTabForCollection} from '../../src/features/collections/services/cloudActiveTab.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const w1='workspace-1',w2='workspace-2',c1='collection-1',c2='collection-2';
const tabs=[
  {id:'tab-haha',name:'haha',source:{scope:'workspace',workspaceId:w1,collectionId:c1,requestId:'r-haha',revision:3}},
  {id:'tab-hehehe',name:'hehehe',source:{scope:'workspace',workspaceId:w1,collectionId:c1,requestId:'r-hehehe'}},
  {id:'tab-pending',source:{scope:'workspace',workspaceId:w1,collectionId:c1,pending:true,folderId:'f1'}},
  {id:'tab-elsewhere',source:{scope:'workspace',workspaceId:w2,collectionId:c1,requestId:'r-haha'}},
  {id:'tab-local',source:{scope:'local',collectionId:c1,requestId:'r-haha'}}
];
test('Cloud highlight follows the active tab, not an earlier selected row',()=>{
  assert.deepEqual(activeCloudTabForCollection(tabs,'tab-haha',w1,c1),{requestId:'r-haha',pendingTabId:null});
  assert.deepEqual(activeCloudTabForCollection(tabs,'tab-hehehe',w1,c1),{requestId:'r-hehehe',pendingTabId:null});
});
test('Active Cloud tab is scoped to workspace and collection, never leaks across trees',()=>{
  for(const [id,workspace,collection] of [
    ['tab-haha',w2,c1],['tab-haha',w1,c2],['tab-local',w1,c1],['missing',w1,c1]
  ])assert.deepEqual(activeCloudTabForCollection(tabs,id,workspace,collection),{requestId:null,pendingTabId:null});
  assert.equal(activeCloudTabForCollection(tabs,'tab-elsewhere',w2,c1).requestId,'r-haha');
});
test('Unsaved Cloud draft highlights its own pending row, rather than a saved request',()=>{
  assert.deepEqual(activeCloudTabForCollection(tabs,'tab-pending',w1,c1),{requestId:null,pendingTabId:'tab-pending'});
});
test('Cloud row selection remains separate from active-tab state and modifiers do not open a tab',()=>{
  const tree=read('../../src/features/collections/components/CloudFolderTree.jsx');
  const explorer=read('../../src/features/collections/components/WorkbenchExplorer.jsx');
  const style=read('../../src/styles/layers/cloud-folder-polish.css');
  assert.match(tree,/activeRequestId\?requestKey\(activeRequestId\)/);
  assert.match(tree,/onClick:e=>choose\(e,requestKey\(r\.id\)\)/);
  assert.match(explorer,/selectionProps\.onClick\?\.\(e\)!==false/);
  assert.match(explorer,/aria-current=\{tabActive\?'page':undefined\}/);
  assert.match(explorer,/pp-cloud-tab-active/);
  assert.match(style,/\.pp-cloud-selected:not\(\.pp-cloud-tab-active\)/);
});
test('Folder tones are identical for collection, child and grandchild; menu icons are explicit',()=>{
  const tree=read('../../src/features/collections/components/CloudFolderTree.jsx');
  const explorer=read('../../src/features/collections/components/WorkbenchExplorer.jsx');
  const style=read('../../src/styles/layers/cloud-folder-polish.css');
  const menu=read('../../src/components/ui/MenuActionItem.jsx');
  assert.match(tree,/FolderClosed className="pp-cloud-folder-icon"/);
  assert.match(explorer,/FolderClosed className="pp-cloud-folder-icon"/);
  assert.match(style,/\.pp-cloud-folder-row svg\.pp-cloud-folder-icon/);
  assert.match(style,/\.pp-cloud-collection-row svg\.pp-cloud-folder-icon/);
  for(const [id,icon] of [['newFolder','FolderPlus'],['runCollection','Play'],['variables','Braces']])
    assert.match(menu,new RegExp(`\\b${id}: ${icon}\\b`));
  assert.match(tree,/<MenuActionItem action="newFolder"/);
});
