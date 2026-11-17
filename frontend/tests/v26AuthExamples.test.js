import { readWorkbenchSource } from './support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAuthorization,workspaceAuthMetadata,restoredAuthMetadata} from '../src/features/authorization.js';
import {encodeStoredHeaders,decodeStoredHeaders} from '../src/features/requestMetadata.js';
import {createPostmanCollection,parsePostmanCollection,blankDraft} from '../src/features/importExport.js';
import {exportOpenApiCollection} from '../src/features/exportFormats.js';
const command={method:'GET',url:'https://example.org/path?q=one',headers:{'X-Existing':'ok'}};

test('Bearer supports {{AuthToken}} and does not mutate original headers',()=>{
  const outgoing=applyAuthorization(command,{authType:'bearer',bearerToken:'{{AuthToken}}'},{AuthToken:'example-token'});
  assert.equal(outgoing.headers.Authorization,'Bearer example-token');
  assert.equal(command.headers.Authorization,undefined);
});
test('Basic Auth supports UTF-8 variable username and password',()=>{
  const result=applyAuthorization(command,{authType:'basic',basicUsername:'{{user}}',basicPassword:'{{pass}}'},{user:'Sigit',pass:'päss'});
  assert.equal(result.headers.Authorization,'Basic '+Buffer.from('Sigit:päss','utf8').toString('base64'));
});
test('API Key header replaces case-insensitive duplicate; query location replaces existing param',()=>{
  const header=applyAuthorization({...command,headers:{'x-api-key':'old'}},{authType:'apiKey',apiKeyIn:'header',apiKeyName:'X-API-Key',apiKeyValue:'{{key}}'},{key:'new'});
  assert.equal(header.headers['X-API-Key'],'new');
  assert.equal(Object.keys(header.headers).filter(x=>x.toLowerCase()==='x-api-key').length,1);
  const query=applyAuthorization(command,{authType:'apiKey',apiKeyIn:'query',apiKeyName:'q',apiKeyValue:'{{key}}'},{key:'new'});
  assert.equal(new URL(query.url).searchParams.get('q'),'new');
  assert.equal(new URL(query.url).searchParams.getAll('q').length,1);
});
test('No Auth leaves existing manual Authorization header unchanged',()=>{
  const original={...command,headers:{Authorization:'Basic external'}};
  assert.deepEqual(applyAuthorization(original,{authType:'none'}),original);
});
test('unresolved auth variables fail closed; workspace metadata rejects literal credential',()=>{
  assert.throws(()=>applyAuthorization(command,{authType:'bearer',bearerToken:'{{missing}}'},{}),/Unresolved/);
  assert.throws(()=>workspaceAuthMetadata({authType:'bearer',bearerToken:'super-secret'}),/\{\{variable\}\}/);
  assert.throws(()=>workspaceAuthMetadata({authType:'apiKey',apiKeyValue:'literal',apiKeyName:'X-API-Key'}),/\{\{variable\}\}/);
  assert.deepEqual(workspaceAuthMetadata({authType:'basic',basicUsername:'user',basicPassword:'{{password}}'}),{authType:'basic',basicUsername:'user',basicPassword:'{{password}}'});
});
test('workspace auth metadata roundtrip with existing response examples',()=>{
  const example={name:'Success',statusCode:200,body:'{}',headers:{'Content-Type':'application/json'}};
  const raw=encodeStoredHeaders([],[],'My docs',[example],{authType:'apiKey',apiKeyName:'x-key',apiKeyValue:'{{myKey}}',apiKeyIn:'query'});
  const decoded=decodeStoredHeaders(raw);
  assert.equal(decoded.documentation,'My docs');
  assert.equal(decoded.responseExamples[0].name,'Success');
  assert.equal(decoded.auth.authType,'apiKey');
  assert.equal(decoded.auth.apiKeyIn,'query');
  assert.equal(decoded.auth.apiKeyValue,'{{myKey}}');
  assert.equal(restoredAuthMetadata({authType:'bearer',bearerToken:'malicious-literal'}).bearerToken,'');
});
test('Postman and OpenAPI can describe Basic and API Key auth',()=>{
  const draft={...blankDraft(),name:'Example',method:'GET',url:'https://example.org/get',authType:'basic',basicUsername:'person',basicPassword:'{{pw}}'};
  const postman=createPostmanCollection([draft]);
  assert.equal(postman.item[0].request.auth.type,'basic');
  assert.equal(parsePostmanCollection(postman)[0].authType,'basic');
  const openapi=exportOpenApiCollection([draft]);
  assert.deepEqual(openapi.components.securitySchemes.basicAuth,{type:'http',scheme:'basic'});
  const api=exportOpenApiCollection([{...draft,authType:'apiKey',apiKeyName:'X-Auth',apiKeyValue:'{{apiKey}}',apiKeyIn:'header'}]);
  assert.deepEqual(api.paths['/get'].get.security,[{apiKey_header_X_Auth:[]}]);
});
test('local and Neon collection examples collapse by default and provide accessible chevrons',()=>{
  const local=readFileSync(new URL('../src/features/LocalCollectionsTree.jsx',import.meta.url),'utf8');
  const app=readWorkbenchSource();
  assert.match(local,/expanded\[exampleKey\]\?\?!!search/);
  assert.match(local,/pp-endpoint-example-toggle/);
  const explorer=readFileSync(new URL('../src/features/collections/components/WorkbenchExplorer.jsx',import.meta.url),'utf8');
  assert.match(explorer,/expandedWorkspaceExamples\[/);
  assert.match(explorer,/pp-workspace-example-toggle/);
  assert.match(app, /<VariableAwareInput placeholder="\{\{AuthToken\}\}/);
  assert.match(app, /ariaLabel="Bearer token"/);
});
