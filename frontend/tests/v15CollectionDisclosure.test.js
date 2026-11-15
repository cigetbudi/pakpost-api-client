import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  workspaceCollectionKey,isWorkspaceCollectionOpen,toggleWorkspaceCollection,
  setAllWorkspaceCollections,collectLocalExpansionKeys
} from '../src/features/collectionExpansion.js';

const id='workspace-test';
test('opening another Neon collection preserves the first one',()=>{
  let expanded={};
  assert.equal(isWorkspaceCollectionOpen(expanded,id,'token','token'),true);
  expanded=toggleWorkspaceCollection(expanded,id,'token-copy','token');
  assert.equal(isWorkspaceCollectionOpen(expanded,id,'token','token-copy'),true);
  assert.equal(isWorkspaceCollectionOpen(expanded,id,'token-copy','token-copy'),true);
  expanded=toggleWorkspaceCollection(expanded,id,'token-copy','token-copy');
  assert.equal(isWorkspaceCollectionOpen(expanded,id,'token','token-copy'),true);
  assert.equal(isWorkspaceCollectionOpen(expanded,id,'token-copy','token-copy'),false);
});

test('Expand all / Collapse all toggles every Neon collection, not just selected',()=>{
  const ids=['a','b','c'];
  let value=setAllWorkspaceCollections({},id,ids,true);
  ids.forEach(key=>assert.equal(value[workspaceCollectionKey(id,key)],true));
  value=setAllWorkspaceCollections(value,id,ids,false);
  ids.forEach(key=>assert.equal(value[workspaceCollectionKey(id,key)],false));
});

test('Neon disclosure keys stay separate across workspaces',()=>{
  const value=setAllWorkspaceCollections({},'ws-a',['c1'],true);
  assert.equal(value[workspaceCollectionKey('ws-a','c1')],true);
  assert.equal(value[workspaceCollectionKey('ws-b','c1')],undefined);
});

test('Expand all local collects nested folder keys recursively',()=>{
  const collections=[{id:'local1',requests:[
    {folderPath:['Auth','Sessions']},
    {folderPath:['Auth','Tokens']},
    {folderPath:['Auth','Sessions']},
  ]},{id:'local2',requests:[]}];
  assert.deepEqual(collectLocalExpansionKeys(collections),[
    'collection:local1',
    'local1:["Auth"]',
    'local1:["Auth","Sessions"]',
    'local1:["Auth","Tokens"]',
    'collection:local2'
  ]);
});

test('React UI exposes bulk controls and independent animated disclosure regions',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  const tree=readFileSync(new URL('../src/features/LocalCollectionsTree.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.match(app,/expandOrCollapseAllCollections\(true\)/);
  assert.match(app,/expandOrCollapseAllCollections\(false\)/);
  assert.match(app,/toggleWorkspaceCollectionById\(c\.id\)/);
  assert.match(app,/workspaceRequestLists\[workspaceCollectionKey\(selectedWs,c\.id\)\]/);
  assert.match(tree,/expandAllSignal/);
  assert.match(tree,/pp-collection-motion/);
  assert.match(css,/grid-template-rows:0fr/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
