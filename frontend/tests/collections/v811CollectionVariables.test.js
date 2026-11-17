import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectionVariableKey,readCollectionVariables,writeCollectionVariables,resolvedScriptVariables} from '../../src/features/collections/services/collectionVariableSession.js';

const source = {scope:'workspace',workspaceId:'ws-1',collectionId:'col-1'};
test('collection scope is isolated across accounts, workspaces and collections',()=>{
  assert.notEqual(collectionVariableKey(source,'tab','alice'),collectionVariableKey(source,'tab','bob'));
  assert.notEqual(collectionVariableKey(source,'tab','alice'),collectionVariableKey({...source,workspaceId:'ws-2'},'tab','alice'));
  assert.notEqual(collectionVariableKey(source,'tab','alice'),collectionVariableKey({...source,collectionId:'col-2'},'tab','alice'));
  assert.equal(collectionVariableKey(source,'tab-a','alice'),collectionVariableKey(source,'tab-b','alice'));
  assert.notEqual(collectionVariableKey(null,'tab-a','alice'),collectionVariableKey(null,'tab-b','alice'));
});
test('collection values are copied, session-only and string-converted',()=>{
  const store=new Map();const key=collectionVariableKey(source,'tab','alice');
  writeCollectionVariables(store,key,{stan:123456});
  const snapshot=readCollectionVariables(store,key);
  assert.deepEqual(snapshot,{stan:'123456'});
  snapshot.stan='tampered';
  assert.equal(readCollectionVariables(store,key).stan,'123456');
});
test('Postman variable precedence: local then environment then collection',()=>{
  assert.deepEqual(resolvedScriptVariables({x:'collection',a:'1'},{x:'environment',b:'2'},{x:'local'}),{a:'1',b:'2',x:'local'});
});
test('QuickJS bridge implements collectionVariables set/get/has/unset/clear and returns scope',()=>{
  const worker=readFileSync(new URL('../../src/features/requests/services/sandbox.worker.js',import.meta.url),'utf8');
  for(const method of ['get','set','has','unset','clear','toObject'])assert.match(worker,new RegExp(`${method}:`));
  assert.match(worker,/collectionVariables:__collectionScope/);
  assert.match(worker,/collectionVariables:__collection,/);
});
