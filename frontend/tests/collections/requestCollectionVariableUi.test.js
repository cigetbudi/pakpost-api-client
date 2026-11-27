import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeRequestVariableUi} from '../../src/features/collections/services/requestCollectionVariableUi.js';
const sensitive=(key,row)=>!!row?.isSecret||/token|secret|api_key/i.test(key);
function make(overrides={}){
  const env={BASE_URL:'https://env.example.test'};
  const environmentUi={variables:env,definitions:[{key:'BASE_URL'}],source:'Local / Dev',onEditVariable:(...args)=>['env',...args]};
  return mergeRequestVariableUi({environmentUi,varsFromEnv:()=>({...env}),collectionName:'Example',
    collectionRows:[{key:'BASE_URL'},{key:'TOKEN',isSecret:true},{key:'REQUEST_BODY'}],
    collectionValues:{BASE_URL:'https://collection.example.test',TOKEN:'fake-token',REQUEST_BODY:'{}'},
    editCollection:(...args)=>['collection',...args],isSensitiveVariable:sensitive,...overrides});
}
test('collection variables resolve with no selected environment',()=>{
  const result=make({environmentUi:{variables:{},definitions:[],source:'No active environment'},varsFromEnv:()=>({})});
  assert.equal(result.variableUi.variables.BASE_URL,'https://collection.example.test');
  assert.equal(result.varsForRequest(false).TOKEN,'[REDACTED]');
  assert.equal(result.variableUi.definitions.find(row=>row.key==='TOKEN').isSecret,true);
});
test('environment overrides collection; codegen masks collection secrets',()=>{
  const result=make();
  assert.equal(result.varsForRequest().BASE_URL,'https://env.example.test');
  assert.equal(result.varsForRequest(false).TOKEN,'[REDACTED]');
  assert.equal(result.variableUi.variables.REQUEST_BODY,'{}');
});
test('quick edit routes to the owning scope',async()=>{
  const {variableUi}=make();
  assert.deepEqual(await variableUi.onEditVariable('BASE_URL','new'),['env','BASE_URL','new']);
  assert.deepEqual(await variableUi.onEditVariable('TOKEN','new'),['collection','TOKEN','new']);
});
test('restricted collection secret without a session value stays unavailable',()=>{
  const result=make({collectionRows:[{key:'TOKEN',isSecret:true,isRedacted:true}],collectionValues:{}});
  assert.equal(Object.hasOwn(result.variableUi.variables,'TOKEN'),false);
  assert.equal(result.variableUi.definitions.find(row=>row.key==='TOKEN').isRedacted,true);
});
test('does not mutate environment or collection scope',()=>{
  const collectionValues={TOKEN:'fake-token'};
  const environment={BASE_URL:'https://example.test'};
  const result=make({collectionValues,varsFromEnv:()=>environment});
  result.varsForRequest(false);
  assert.deepEqual(collectionValues,{TOKEN:'fake-token'});
  assert.deepEqual(environment,{BASE_URL:'https://example.test'});
});
