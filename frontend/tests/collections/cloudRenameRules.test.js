import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloudFolderNameError,renameActionError} from '../../src/features/collections/services/renameValidation.js';
import {workspaceCollectionKey} from '../../src/features/collections/services/collectionExpansion.js';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const folders = [
  {id:'root-a',parentFolderId:null,name:'Authentication'},
  {id:'root-b',parentFolderId:null,name:'Other'},
  {id:'child-a',parentFolderId:'root-a',name:'Login'},
  {id:'child-b',parentFolderId:'root-a',name:'Profile'},
  {id:'child-c',parentFolderId:'root-b',name:'Login'},
];

test('folder rename disables unchanged name and same-parent duplicates but allows same name in another parent',()=>{
  assert.match(cloudFolderNameError(folders,{mode:'rename',id:'child-a',name:'Login'}),/not changed/i);
  assert.match(cloudFolderNameError(folders,{mode:'rename',id:'child-a',name:' login '}),/not changed/i);
  assert.match(cloudFolderNameError(folders,{mode:'rename',id:'child-a',name:' profile '}),/already exists/i);
  assert.equal(cloudFolderNameError(folders,{mode:'rename',id:'child-a',name:'Logout'}),'');
  assert.match(cloudFolderNameError(folders,{mode:'create',parentId:'root-a',name:'LOGIN'}),/already exists/i);
  assert.equal(cloudFolderNameError(folders,{mode:'create',parentId:'root-b',name:'Profile'}),'');
  assert.match(cloudFolderNameError(folders,{mode:'create',parentId:null,name:' '}),/required/i);
});

test('Cloud request renaming rejects same and sibling names but not names in other folders',()=>{
  const ws='ws-1',col='col-1';
  const ctx={selectedWs:ws,workspaceCollectionKey,workspaceRequestLists:{
    [workspaceCollectionKey(ws,col)]:[
      {id:'req-1',name:'Login',folderId:'folder-a'},
      {id:'req-2',name:'Logout',folderId:'folder-a'},
      {id:'req-3',name:'Ping',folderId:'folder-b'},
    ]
  }};
  const a={scope:'workspace',action:'renameRequest',collectionId:col,requestId:'req-1',name:'Login'};
  assert.match(renameActionError(a,' Login ',ctx),/not changed/i);
  assert.match(renameActionError(a,'lOgOuT',ctx),/already exists/i);
  assert.equal(renameActionError(a,'Ping',ctx),'');
  assert.equal(renameActionError(a,'Login v2',ctx),'');
});

test('Collection and Local request renames prevent duplicates without blocking separate folder names',()=>{
  const ctx={collections:[{id:'c1',name:'API'},{id:'c2',name:'Banking'}],
    localCollections:[{id:'l1',name:'Local',requests:[
      {id:'r1',name:'Auth',folderPath:['A']},
      {id:'r2',name:'Transfer',folderPath:['A']},
      {id:'r3',name:'Transfer',folderPath:['B']},
    ]}]};
  assert.match(renameActionError({scope:'workspace',action:'renameCollection',collectionId:'c1',name:'API'},' BANKING ',ctx),/already exists/i);
  assert.match(renameActionError({scope:'local',action:'renameRequest',collectionId:'l1',requestId:'r1',name:'Auth'},' transfer ',ctx),/already exists/i);
  assert.equal(renameActionError({scope:'local',action:'renameRequest',collectionId:'l1',requestId:'r1',name:'Auth'},'Other',ctx),'');
});

test('First-click F2 and Delete survive active-tab transition; modal Enter submits a form',()=>{
  const tree=read('../../src/features/collections/components/CloudFolderTree.jsx');
  const explorer=read('../../src/features/collections/components/WorkbenchExplorer.jsx');
  assert.match(tree,/setSelection\(key\?\[key\]:\[\]\)/);
  assert.match(tree,/\[activeTabId,activeRequestId\]/);
  assert.match(explorer,/activeRequestId=\{activeCloud\.requestId\}/);
  assert.match(tree,/closest\?\.\('\[data-cloud-select-key\]'\)/);
  assert.match(tree,/event\.key==='F2'/);
  assert.match(tree,/event\.key==='Delete'/);
  assert.match(tree,/onSubmit=\{event=>\{event\.preventDefault\(\);if\(!busy\)deleteSelected\(\);\}\}/);
  assert.match(tree,/<button autoFocus type="submit" disabled=\{busy\}/);
});

test('Both folder and request rename block Enter and disable submission for unchanged/duplicate name',()=>{
  const tree=read('../../src/features/collections/components/CloudFolderTree.jsx');
  const dialogs=read('../../src/features/requests/components/RequestDialogs.jsx');
  const controller=read('../../src/features/collections/controllers/createCollectionDialogActions.js');
  assert.match(tree,/disabled=\{busy\|\|!!folderNameError\}/);
  assert.match(tree,/if\(!editing\|\|cloudFolderNameError\(folders,editing\)\)return/);
  assert.match(dialogs,/disabled=\{busyAction\|\|!!renameError\}/);
  assert.match(controller,/action\.startsWith\('rename'\)&&renameActionError/);
});
