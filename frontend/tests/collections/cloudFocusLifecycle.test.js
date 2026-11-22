import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoreDialogFocus} from '../../src/components/ui/dialogFocus.js';
import {restoreCloudFolderFocus} from '../../src/features/collections/services/cloudFocus.js';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
function element(key='', options={}) {
  return {
    dataset:{cloudSelectKey:key},isConnected:options.connected!==false,
    closest:()=>options.hidden?{}:null,
    focusCalls:[],focus(config){this.focusCalls.push(config)}
  };
}
const documentWith = active => ({body:element('body'),activeElement:active});

test('cancel/ESC restores request F2/Delete focus after modal unmount',()=>{
  const selected=element('request:r1');
  const dialog={isConnected:false};
  const doc=documentWith(selected);
  doc.activeElement=doc.body;
  assert.equal(restoreDialogFocus(selected,dialog,doc),true);
  assert.deepEqual(selected.focusCalls,[{preventScroll:true}]);
});

test('successful rename can return focus to the same request row',()=>{
  const row=element('request:r1');
  const doc=documentWith(null);
  doc.activeElement=doc.body;
  assert.equal(restoreDialogFocus(row,null,doc),true);
  assert.equal(restoreDialogFocus(row,{isConnected:true},doc),false);
  assert.equal(row.focusCalls.length,1);
});

test('dialog focus restoration never steals focus or targets a removed/hidden row',()=>{
  const selected=element('request:r1');
  const editor=element('editor');
  const doc=documentWith(editor);
  assert.equal(restoreDialogFocus(selected,null,doc),false);
  assert.equal(restoreDialogFocus(element('request:r1',{connected:false}),null,documentWith(null)),false);
  assert.equal(restoreDialogFocus(element('request:r1',{hidden:true}),null,documentWith(null)),false);
  assert.equal(selected.focusCalls.length,0);
});

test('inline folder Cancel/ESC/Save can return focus to original folder after input disappears',()=>{
  const folder=element('folder:f1');
  const root={querySelectorAll:()=>[element('folder:other'),folder]};
  const doc=documentWith(null);doc.activeElement=doc.body;
  assert.equal(restoreCloudFolderFocus(root,'folder:f1',doc),true);
  assert.deepEqual(folder.focusCalls,[{preventScroll:true}]);
});

test('inline folder restoration skips removed folder and active input',()=>{
  const folder=element('folder:f1');
  const root={querySelectorAll:()=>[folder]};
  assert.equal(restoreCloudFolderFocus(root,'folder:gone',documentWith(null)),false);
  assert.equal(restoreCloudFolderFocus(root,'folder:f1',documentWith(element('editor'))),false);
  assert.equal(folder.focusCalls.length,0);
});

test('focus is restored through dialog cleanup, and folder edit escape is implemented',()=>{
  const dialog=read('../../src/components/ui/WorkbenchPrimitives.jsx');
  const tree=(read('../../src/features/collections/components/CloudFolderTree.jsx')+'\n'+read('../../src/features/collections/components/renderCloudFolderNodes.jsx'));
  const requestDialog=(read('../../src/features/requests/components/RequestDialogs.jsx')+'\n'+read('../../src/features/requests/components/UnsavedChangesDialog.jsx')+'\n'+read('../../src/features/requests/components/SaveResponseExampleDialog.jsx')+'\n'+read('../../src/features/requests/components/RequestRevisionDialogs.jsx')+'\n'+read('../../src/features/requests/components/RequestStorageDialogs.jsx'));
  assert.match(dialog,/previouslyFocused\.current = document\.activeElement/);
  assert.match(dialog,/restoreDialogFocus\(previouslyFocused\.current, dialogRef\.current, document\)/);
  assert.match(dialog,/event\.key === 'Escape'/);
  assert.match(tree,/restoreCloudFolderFocus\(rootRef\.current,key,document\)/);
  assert.match(tree,/lastEditedFolderRef\.current=folderKey\(editing\.id\)/);
  assert.match(tree,/event\.key==='Escape'.*setEditing\(null\)/);
  assert.match(requestDialog,/onKeyDown=\{e=>\{if\(e\.key==='Escape'\)/);
  assert.match(tree,/onKeyDown=\{onKeys\}/);
});
