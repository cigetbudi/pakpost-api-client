import test from 'node:test';
import assert from 'node:assert/strict';
import {activeRows,encodeStoredHeaders,decodeStoredHeaders,META_KEY} from '../src/features/requestMetadata.js';
import {buildCommand,resolveRows} from '../src/features/requestTools.js';
import {applyLocalAction} from '../src/features/localCollectionActions.js';
import {createPostmanCollection,parsePostmanCollection,createLocalPostmanExport,parseImportText} from '../src/features/importExport.js';
import {exportCollectionByFormat,exportOpenApiCollection} from '../src/features/exportFormats.js';

const request={name:'Get user',requestName:'Get user',method:'GET',url:'https://api.example.com/users',
  documentation:'Read a user\n\nReturns profile details.',folderPath:['People'],
  rows:[{key:'X-Client',value:'web',description:'Client channel',enabled:true},{key:'X-Disabled',value:'secret',description:'Optional testing header',enabled:false}],
  params:[{key:'limit',value:'20',description:'Maximum results',enabled:true},{key:'debug',value:'true',description:'Debug only',enabled:false}],
  format:'application/json',body:'',preScript:'',postScript:''};

test('disabled header/params survive saved JSONB, but do not become transport headers',()=>{
  const raw=encodeStoredHeaders(request.rows,request.params,request.documentation);
  const stored=JSON.parse(raw);
  assert.equal(stored['X-Client'],'web');
  assert.equal('X-Disabled' in stored,false);
  assert.ok(stored[META_KEY]);
  const restored=decodeStoredHeaders(raw);
  assert.deepEqual(restored.headers,request.rows);
  assert.deepEqual(restored.params,request.params);
  assert.equal(restored.documentation,request.documentation);
  assert.deepEqual(activeRows(restored.headers).map(x=>x.key),['X-Client']);
  const outgoing=buildCommand({method:'GET',url:request.url,headers:restored.headers,body:'',format:'none'});
  assert.deepEqual(outgoing.headers,{'X-Client':'web'});
  assert.deepEqual(resolveRows(restored.params,{}).map(x=>x.key),['limit']);
});

test('disabled Content-Type suppresses automatically generated raw MIME; enabling preserves custom value',()=>{
  const raw={method:'POST',url:'https://example.com/api',format:'application/json',body:'{}'};
  const off=buildCommand({...raw,headers:[{key:'Content-Type',value:'text/xml',enabled:false}]});
  assert.equal(off.contentType,null);assert.equal('Content-Type' in off.headers,false);
  const on=buildCommand({...raw,headers:[{key:'Content-Type',value:'text/xml',enabled:true}]});
  assert.equal(on.contentType,'text/xml');assert.equal(on.headers['Content-Type'],'text/xml');
});

test('legacy workspace JSON headers load without metadata',()=>{
  const old=decodeStoredHeaders('{"Accept":"application/json"}');
  assert.equal(old.headers.length,1);assert.equal(old.headers[0].enabled,true);
  assert.deepEqual(old.params,[]);
  assert.equal(old.documentation,'');
});

test('OpenAPI includes description on operation, header and query; disabled ones omitted',()=>{
  const doc=exportOpenApiCollection([request],{name:'People API',documentation:'A collection description',folderDocs:{'["People"]':'People folder documentation'}});
  assert.equal(doc.info.description,'A collection description');
  assert.equal(doc.tags[0].description,'People folder documentation');
  const op=doc.paths['/users'].get;
  assert.equal(op.description,request.documentation);
  assert.equal(op.parameters.find(x=>x.name==='X-Client').description,'Client channel');
  assert.equal(op.parameters.find(x=>x.name==='limit').description,'Maximum results');
  assert.equal(op.parameters.some(x=>x.name==='X-Disabled'),false);
  assert.equal(op.parameters.some(x=>x.name==='debug'),false);
});

test('Postman export preserves item description, disabled flags and descriptions on rows',()=>{
  const postman=createPostmanCollection([request],{name:'People API'});
  const item=postman.item[0];
  assert.equal(item.request.description,request.documentation);
  assert.equal(item.request.header[1].disabled,true);
  assert.equal(item.request.header[1].description,'Optional testing header');
  assert.equal(item.request.url.query[1].disabled,true);
  const result=parsePostmanCollection(postman)[0];
  assert.equal(result.documentation,request.documentation);
  assert.equal(result.rows[1].enabled,false);
  assert.equal(result.params[1].enabled,false);
});

test('folder markdown is exported/imported to Postman; OpenAPI keeps tags',()=>{
 const col={id:'col1',name:'Main',documentation:'Root docs',folderDocs:{'["People"]':'Folder docs'},requests:[request]};
 const exported=createLocalPostmanExport([col]);
 assert.equal(exported.item[0].description,'Root docs');
 assert.equal(exported.item[0].item[0].description,'Folder docs');
 const wrapper=exportCollectionByFormat([request],{name:'Main',format:'postman',localCollection:col});
 assert.equal(wrapper.info.description,'Root docs');
 const imported=parseImportText(JSON.stringify(wrapper));
 assert.equal(imported.collections[0].documentation,'Root docs');
 assert.equal(imported.collections[0].folderDocs['["People"]'],'Folder docs');
});

test('local docs follow rename, duplicate and delete folder',()=>{
 const initial=[{id:'c1',name:'Collection',folderDocs:{'["A"]':'A docs','["A","Sub"]':'Sub docs'},requests:[{id:'r1',folderPath:['A','Sub'],requestName:'One'}]}];
 let c=applyLocalAction(initial,{type:'renameFolder',collectionId:'c1',folderPath:['A'],name:'B'});
 assert.equal(c[0].folderDocs['["B","Sub"]'],'Sub docs');
 c=applyLocalAction(c,{type:'duplicateFolder',collectionId:'c1',folderPath:['B']},()=>Math.random().toString());
 assert.equal(c[0].folderDocs['["B (copy)","Sub"]'],'Sub docs');
 c=applyLocalAction(c,{type:'deleteFolder',collectionId:'c1',folderPath:['B']});
 assert.equal(c[0].folderDocs['["B"]'],undefined);
 assert.equal(c[0].folderDocs['["B (copy)"]'],'A docs');
});
