import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startFolderDrag,isFolderDrag,readFolderDrag,endFolderDrag} from '../../src/features/collections/services/folderDrag.js';
import {localFolderMoveTargets,cloudFolderMoveTargets} from '../../src/features/collections/services/folderMoveTargets.js';
import {applyLocalAction} from '../../src/features/collections/services/localCollectionActions.js';

const source=file=>readFileSync(new URL(file,import.meta.url),'utf8');
function transfer(){
  const data=new Map();
  return {types:[],effectAllowed:'',setData(type,value){data.set(type,value);this.types.push(type);},getData(type){return data.get(type)||'';},delete(type){data.delete(type);}};
}

test('native folder drag carries MIME and plain-text fallback for Chromium/Firefox',()=>{
  const mime='application/x-pakpost-cloud-folder';
  const event=transfer();
  const payload={collectionId:'col-1',folderId:'f-1'};
  startFolderDrag(event,mime,payload);
  assert.equal(event.effectAllowed,'move');
  assert.equal(isFolderDrag(event,mime),true);
  assert.deepEqual(readFolderDrag(event,mime),payload);
  event.delete(mime);
  assert.deepEqual(readFolderDrag(event,mime),payload);
  endFolderDrag();
  assert.equal(isFolderDrag({types:['text/plain']},mime),false);
  assert.equal(readFolderDrag({types:['text/plain'],getData:()=>JSON.stringify(payload)},mime),null);
});

test('Local move selector lists root and siblings but never the dragged subtree',()=>{
  const collection={folderDocs:{'["A"]':'docs','["A","Inner"]':'docs','["B"]':'docs'},requests:[
    {id:'r1',folderPath:['A','Inner']},{id:'r2',folderPath:['B']}]};
  const targets=localFolderMoveTargets(collection,['A']).map(JSON.stringify);
  assert.deepEqual(targets,['[]','["B"]']);
  const child=localFolderMoveTargets(collection,['A','Inner']).map(JSON.stringify);
  assert.ok(child.includes('[]')&&child.includes('["A"]')&&child.includes('["B"]'));
});

test('Cloud move selector excludes source and descendants and preserves root',()=>{
  const folders=[
    {id:'a',name:'A',parentFolderId:null},
    {id:'child',name:'Child',parentFolderId:'a'},
    {id:'b',name:'B',parentFolderId:null}];
  assert.deepEqual(cloudFolderMoveTargets(folders,'a').map(x=>x.id),[null,'b']);
  assert.deepEqual(cloudFolderMoveTargets(folders,'child').map(x=>x.id),[null,'a','b']);
});

test('moving a Local folder to another folder and back keeps requests and docs',()=>{
  const initial=[{id:'col',name:'Example',folderDocs:{'["A"]':'documentation'},requests:[
    {id:'r1',folderPath:['A'],responseExamples:[]},{id:'r2',folderPath:['B'],responseExamples:[]}]}];
  const nested=applyLocalAction(initial,{type:'moveFolder',collectionId:'col',folderPath:['A'],targetFolderPath:['B']});
  const back=applyLocalAction(nested,{type:'moveFolder',collectionId:'col',folderPath:['B','A'],targetFolderPath:[]});
  assert.deepEqual(nested[0].requests[0].folderPath,['B','A']);
  assert.deepEqual(back[0].requests[0].folderPath,['A']);
  assert.equal(back[0].folderDocs['["A"]'],'documentation');
});

test('both explorer types expose real menu move and drop to root routes',()=>{
  const local=(source('../../src/features/collections/components/LocalCollectionsTree.jsx')+'\n'+source('../../src/features/collections/components/LocalCollectionBranch.jsx'));
  const cloud=(source('../../src/features/collections/components/CloudFolderTree.jsx')+'\n'+source('../../src/features/collections/components/renderCloudFolderNodes.jsx'));
  const explorer=source('../../src/features/collections/components/WorkbenchExplorer.jsx');
  assert.match(local,/\['moveFolder','Move to…'\]/);
  assert.match(local,/localFolderMoveTargets/);
  assert.match(local,/startFolderDrag/);
  const moveDialog=source('../../src/features/collections/components/CloudFolderMoveDialog.jsx');
  assert.match(cloud,/<CloudFolderMoveDialog/);
  assert.match(moveDialog,/Move Cloud folder/);
  assert.match(moveDialog,/cloudFolderMoveTargets/);
  assert.match(cloud,/parentFolderId:targetId,version:current\.version/);
  assert.match(explorer,/pakpost:cloud-folder-drop-root/);
});
