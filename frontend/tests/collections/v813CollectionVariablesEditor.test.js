import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectionVariableKey,readCollectionVariables,writeCollectionVariables,resetCollectionVariables,
  savedCollectionVariableMap,validateCollectionVariableRows} from '../../src/features/collections/services/collectionVariableSession.js';
import {parseImportText} from '../../src/features/import-export/services/importExport.js';
import {exportCollectionByFormat} from '../../src/features/import-export/services/exportFormats.js';
import {toLocalCollection,writeLocalCollections,readLocalCollections} from '../../src/features/collections/services/localCollections.js';
import {saveCloudCollections} from '../../src/features/import-export/services/storageScope.js';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Saved defaults are used until session writes; unset survives subsequent executions',()=>{
  const saved=savedCollectionVariableMap([{key:'stan',value:'100001'},{key:'redacted',value:'',isSecret:true,isRedacted:true}]);
  assert.deepEqual(saved,{stan:'100001'});
  const store=new Map(),key=collectionVariableKey({scope:'local',collectionId:'col1'},'tab1','guest');
  assert.deepEqual(readCollectionVariables(store,key,saved),{stan:'100001'});
  writeCollectionVariables(store,key,{stan:'632799',rrn:'123456789012'});
  assert.equal(readCollectionVariables(store,key,saved).stan,'632799');
  // Explicit script unset must not resurrect saved defaults when a later request starts.
  writeCollectionVariables(store,key,{rrn:'123456789012'});
  assert.deepEqual(readCollectionVariables(store,key,saved),{rrn:'123456789012'});
  resetCollectionVariables(store,key);
  assert.deepEqual(readCollectionVariables(store,key,saved),{stan:'100001'});
});

test('Saved variable validation blocks invalid, duplicate, or oversized values',()=>{
  assert.deepEqual(validateCollectionVariableRows([{key:'stan',value:123}]),[{key:'stan',value:'123',isSecret:false,isRedacted:false}]);
  assert.throws(()=>validateCollectionVariableRows([{key:'a-b',value:'1'}]),/Invalid variable name/);
  assert.throws(()=>validateCollectionVariableRows([{key:'STAN',value:'1'},{key:'stan',value:'2'}]),/Duplicate/);
  assert.throws(()=>validateCollectionVariableRows([{key:'long',value:'x'.repeat(8193)}]),/8192/);
  assert.throws(()=>validateCollectionVariableRows(Array.from({length:101},(_,i)=>({key:`v${i}`,value:''}))),/100/);
});

test('Local saved variables persist while secrets never enter durable recovery',()=>{
  function memory(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),dump:()=>JSON.stringify([...map])};}
  const oldLocal=globalThis.localStorage,oldSession=globalThis.sessionStorage;
  globalThis.localStorage=memory();globalThis.sessionStorage=memory();
  try{
    const collection=toLocalCollection({name:'Token Service',requests:[],variables:[{key:'client',value:'MOBILE'},{key:'token',value:'secret-123',isSecret:true}]},()=> 'collection-id');
    writeLocalCollections([collection]);
    assert.equal(readLocalCollections()[0].variables[1].value,'secret-123');
    assert.doesNotMatch(globalThis.localStorage.dump(),/secret-123/);
    globalThis.sessionStorage.removeItem('pakpost_v5_collections_live');
    assert.equal(readLocalCollections()[0].variables[0].value,'MOBILE');
    assert.equal(readLocalCollections()[0].variables[1].value,'');
  }finally{globalThis.localStorage=oldLocal;globalThis.sessionStorage=oldSession;}
});

test('Postman collection variable roundtrip preserves scope and secret masking',()=>{
  const document={info:{name:'Token Service',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
    variable:[{key:'client',value:'MOBILE',type:'string'},{key:'secretKey',value:'s3cr3t',type:'secret'}],
    item:[{name:'Request Token',request:{method:'GET',url:'https://example.com'}}]};
  const parsed=parseImportText(JSON.stringify(document));
  const imported=toLocalCollection(parsed.collections[0],()=> 'one');
  assert.equal(imported.variables[0].value,'MOBILE');
  const safe=exportCollectionByFormat(imported.requests,{name:imported.name,localCollection:imported});
  assert.equal(safe.variable[1].value,'');
  const unsafe=exportCollectionByFormat(imported.requests,{name:imported.name,localCollection:imported,includeSecrets:true});
  assert.equal(unsafe.variable[1].value,'s3cr3t');
  assert.equal(parseImportText(JSON.stringify(unsafe)).collections[0].variables[1].isSecret,true);
});

test('Cloud import writes explicit saved collection variables before requests',async()=>{
  const calls=[];
  const request=async(path,method,body)=>{
    calls.push({path,method,body});
    if(method==='POST'&&!path.includes('/requests'))return {id:'new-col'};
    return {};
  };
  await saveCloudCollections([{name:'Token Service',variables:[{key:'client',value:'RAYA'}],requests:[{name:'Ping',url:'https://example.com'}]}],
    {workspaceId:'ws',token:'jwt',request});
  assert.equal(calls[0].method,'POST');
  assert.equal(calls[1].path,'/api/workspaces/ws/collections/new-col/variables');
  assert.equal(calls[1].body.version,0);
  assert.equal(calls[2].method,'POST');
});

test('Cloud saved updates are permissioned, version checked and encrypted for secrets',()=>{
  const controller=read('../../../backend/src/Pakpost.Api/Controllers/CollectionsController.cs');
  const handlers=read('../../../backend/src/Pakpost.Application/Internal/Collections/CollectionVariables.cs');
  const migration=read('../../../backend/src/Pakpost.Infrastructure/Persistence/Migrations/20261117110000_CollectionVariables.cs');
  assert.match(controller,/HttpGet\("\{collectionId:guid\}\/variables"\)/);
  assert.match(controller,/HttpPut\("\{collectionId:guid\}\/variables"\)/);
  assert.match(handlers,/WorkspacePermissions\.CollectionWrite/);
  assert.match(handlers,/WorkspacePermissions\.CollectionRead/);
  assert.match(handlers,/WorkspacePermissions\.EnvironmentSecretRead/);
  assert.match(handlers,/cipher\.Protect/);
  assert.match(handlers,/VariablesVersion!=cmd\.Version/);
  assert.match(migration,/variables_json/);
  assert.match(migration,/variables_version/);
});
