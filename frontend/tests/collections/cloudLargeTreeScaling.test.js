import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCloudFolderTree} from '../../src/features/collections/services/cloudFolderTree.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Cloud tree attaches thousands of siblings and nested requests exactly once', () => {
  const folders = Array.from({length: 3500}, (_, i) => ({
    id: `f${i}`, name: `Folder ${i}`, parentFolderId: null,
  }));
  const requests = Array.from({length: 3500}, (_, i) => ({id:`r${i}`,folderId:`f${i}`}));
  const tree = makeCloudFolderTree(folders, requests);
  assert.equal(tree.folders.length, 3500);
  assert.equal(tree.folders.reduce((sum, folder) => sum + folder.requests.length, 0), 3500);
  assert.equal(requests.length, 3500);
});

test('long Cloud ancestry remains correct and invalid cycles cannot hide requests', () => {
  const folders = Array.from({length: 1200}, (_, i) => ({
    id:`f${i}`,name:`Node ${i}`,parentFolderId:i?`f${i-1}`:null,
  }));
  const tree = makeCloudFolderTree(folders,[{id:'deep',folderId:'f1199'}]);
  let branch = tree;
  for (let i=0;i<1200;i++) {
    assert.equal(branch.folders.length,1);
    branch = branch.folders[0];
  }
  assert.equal(branch.requests[0].id,'deep');
  const broken = makeCloudFolderTree([
    {id:'a',name:'A',parentFolderId:'b'},
    {id:'b',name:'B',parentFolderId:'a'},
    {id:'c',name:'C',parentFolderId:'unknown'},
    {id:'d',name:'D',parentFolderId:'c'},
  ],[{id:'r1',folderId:'a'},{id:'r2',folderId:'d'}]);
  assert.equal(broken.folders.length,4);
  assert.equal(broken.folders.reduce((sum,folder)=>sum+folder.requests.length,0),2);
});

test('Cloud and Local Explorer avoid repeated tree work when toggling UI', () => {
  const cloud = read('../../src/features/collections/components/CloudFolderTree.jsx');
  const local = read('../../src/features/collections/components/LocalCollectionsTree.jsx');
  const cloudRows = read('../../src/features/collections/components/CloudRequestRows.jsx');
  const explorer = read('../../src/features/collections/components/WorkbenchExplorer.jsx');
  assert.match(cloud,/selectedKeys\.has\(key\)/);
  assert.match(cloudRows,/selectedKeys\.has\(key\)/);
  assert.match(local,/cachedTree\(col\.requests\)/);
  assert.match(explorer,/new WeakMap\(\)/);
});
