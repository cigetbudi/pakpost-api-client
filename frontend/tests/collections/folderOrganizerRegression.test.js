import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localFolderPaths,localFolderMoveTargets,cloudFolderMoveTargets} from '../../src/features/collections/services/folderMoveTargets.js';
import {applyLocalAction} from '../../src/features/collections/services/localCollectionActions.js';

const source=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');

test('collection-level organizer lists nested Local folders as sources',()=>{
  const col={id:'col',name:'Example',folderDocs:{'["A"]':'docs','["A","Child"]':'nested','["B"]':'other'},requests:[
    {id:'r1',folderPath:['A','Child'],responseExamples:[]},
    {id:'r2',folderPath:['B'],responseExamples:[]} ]};
  assert.deepEqual(localFolderPaths(col),[['A'],['A','Child'],['B']]);
  assert.deepEqual(localFolderMoveTargets(col,['A']),[[],['B']]);
  const moved=applyLocalAction([col],{type:'moveFolder',collectionId:'col',folderPath:['A'],targetCollectionId:'col',targetFolderPath:['B']});
  assert.deepEqual(moved[0].requests[0].folderPath,['B','A','Child']);
  const restored=applyLocalAction(moved,{type:'moveFolder',collectionId:'col',folderPath:['B','A'],targetCollectionId:'col',targetFolderPath:[]});
  assert.deepEqual(restored[0].requests[0].folderPath,['A','Child']);
});

test('Cloud folder organizer permits root and siblings, rejects cycles',()=>{
  const folders=[{id:'a',name:'A',parentFolderId:null},{id:'b',name:'B',parentFolderId:null},{id:'c',name:'Child',parentFolderId:'a'}];
  assert.deepEqual(cloudFolderMoveTargets(folders,'a').map(x=>x.id),[null,'b']);
  assert.deepEqual(cloudFolderMoveTargets(folders,'c').map(x=>x.id),[null,'a','b']);
});

test('Settings route never mounts WorkspaceManager below the Settings screen',()=>{
  const view=source('../../src/app/components/WorkbenchView.jsx');
  assert.match(view,/page === 'workspace' \? <Suspense/);
  assert.match(view,/<\/Suspense> : null\}/);
  assert.match(view,/page==='settings'&&<WorkbenchSettings/);
});

test('Local and Cloud collection action menus link to a folder organizer',()=>{
  const local=source('../../src/features/collections/components/LocalCollectionsTree.jsx');
  const cloud=source('../../src/features/collections/components/CloudFolderTree.jsx');
  const view=source('../../src/app/components/WorkbenchView.jsx');
  const hook=source('../../src/app/hooks/useWorkbenchController.jsx');
  assert.match(local,/\['organizeFolders','Move folder…'\]/);
  assert.match(view,/\['organizeFolders','Move folder…'\]/);
  assert.match(view,/pakpost:cloud-folder-organizer/);
  assert.match(cloud,/pakpost:cloud-folder-organizer/);
  assert.match(hook,/handleWorkspaceMenu, setWorkspaceMenu, tabMenu/);
  assert.match(local,/Folder to move/);
  assert.match(cloud,/<CloudFolderMoveDialog/);
  assert.match(source('../../src/features/collections/components/CloudFolderMoveDialog.jsx'),/Folder to move/);
});
