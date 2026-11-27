import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionTabId,openCollectionTab,mixedTabOrder,moveMixedTab} from '../../src/features/collections/services/collectionWorkbenchTabs.js';
const local={scope:'local',collectionId:'a',name:'Example'};
test('collection tab identities are scope and workspace specific',()=>{
  assert.notEqual(collectionTabId(local),collectionTabId({...local,scope:'workspace',workspaceId:'one'}));
  assert.notEqual(collectionTabId({...local,scope:'workspace',workspaceId:'one'}),collectionTabId({...local,scope:'workspace',workspaceId:'two'}));
});
test('reopening collection preserves its existing draft marker and identity',()=>{
  const tabs=openCollectionTab([],local);tabs[0].dirty=true;
  assert.equal(openCollectionTab(tabs,local),tabs);
  assert.equal(openCollectionTab(tabs,{...local,collectionId:'b'}).length,2);
});
test('mixed order supports dragging collection across requests, new tabs and closed tabs',()=>{
  const requests=[{id:'t1'},{id:'t2'}],collections=openCollectionTab([],local),id=collections[0].id;
  const first=mixedTabOrder(requests,collections);
  assert.deepEqual(first,['t1','t2',id]);
  const moved=moveMixedTab(first,id,'t1','before');
  assert.deepEqual(mixedTabOrder(requests,collections,moved),[id,'t1','t2']);
  assert.deepEqual(mixedTabOrder([{id:'t2'},{id:'t3'}],collections,moved),[id,'t2','t3']);
  assert.deepEqual(mixedTabOrder(requests,[],moved),['t1','t2']);
});
test('request-store reordering stays authoritative in mixed order',()=>{
  const collections=openCollectionTab([],local),id=collections[0].id;
  assert.deepEqual(mixedTabOrder([{id:'t2'},{id:'t1'}],collections,['t1',id,'t2']),['t2',id,'t1']);
});
