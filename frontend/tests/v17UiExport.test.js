import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {exportPostmanEnvironment,exportOpenApiEnvironment,exportOpenApiCollection,exportCollectionByFormat,exportFileName} from '../src/features/exportFormats.js';
const env={id:'e1',name:'DEV',variables:[{key:'baseUrl',value:'https://example.test',isSecret:false},{key:'secret',value:'very-secret',isSecret:true}]};
const request={name:'Create Token',method:'POST',url:'{{baseUrl}}/api/token/{{session}}',rows:[{key:'Authorization',value:'Bearer real-token'}],params:[{key:'limit',value:'10'}],body:'{"test":true}',format:'application/json',preScript:'console.log(123)',authType:'bearer',bearerToken:'secret-token'};
test('Postman environment export is a standard environment payload, with masked secrets by default',()=>{
 const doc=exportPostmanEnvironment(env);
 assert.equal(doc._postman_variable_scope,'environment');
 assert.equal(doc.values.find(v=>v.key==='secret').value,'');
 assert.equal(doc.values.find(v=>v.key==='secret').type,'secret');
 assert.equal(exportPostmanEnvironment(env,{includeSecrets:true}).values.at(-1).value,'very-secret');
});
test('OpenAPI environment uses valid 3.1 document and explicitly vendor-extension metadata',()=>{
 const doc=exportOpenApiEnvironment(env);
 assert.equal(doc.openapi,'3.1.0');assert.deepEqual(doc.paths,{});
 assert.equal(doc['x-pakpost-environment'].variables[1].value,'');
 assert.equal(exportOpenApiEnvironment(env,{includeSecrets:true})['x-pakpost-environment'].variables[1].value,'very-secret');
});
test('OpenAPI collection retains HTTP method, path variables, query params and JSON content type',()=>{
 const doc=exportOpenApiCollection([request],{name:'Token Service'});
 assert.equal(doc.openapi,'3.1.0');
 const op=doc.paths['/api/token/{session}'].post;
 assert.equal(op.summary,'Create Token');
 assert.ok(op.parameters.some(p=>p.in==='path'&&p.name==='session'&&p.required));
 assert.ok(op.parameters.some(p=>p.in==='query'&&p.name==='limit'));
 assert.ok(op.requestBody.content['application/json']);
 assert.equal(doc.components.securitySchemes.bearerAuth.type,'http');
 assert.ok(!JSON.stringify(doc).includes('console.log'));
 assert.ok(!JSON.stringify(doc).includes('secret-token'));
});
test('Postman collection preserves script while not exposing known authorization headers by default',()=>{
 const doc=exportCollectionByFormat([request],{name:'Demo'});
 assert.equal(doc.item[0].request.header[0].value,'{{REDACTED}}');
 assert.ok(doc.item[0].event.some(x=>x.listen==='prerequest'));
 assert.equal(exportFileName('Token Service','openapi'),'Token_Service.openapi.json');
});
test('v17 app connects export, environment dialog, branding, and global toast portal',()=>{
 const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
 const explorer=readFileSync(new URL('../src/features/EnvironmentExplorer.jsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/features/collections/components/WorkbenchExplorer.jsx',import.meta.url),'utf8');
 assert.match(panel,/onDuplicate=\{duplicateEnvironment\}/);
 assert.match(panel,/onExport=\{environment=>openExportChoice/);
 assert.match(app,/createPortal\(<div className="pp-toast pp-toast-note"/);
 assert.match(explorer,/pp-env-editor-modal-backdrop/);
 assert.match(explorer,/Export as/);
 for(const mode of ['light','dark'])assert.ok(existsSync(new URL(`../public/branding/pakpost-logo-${mode}.svg`,import.meta.url)));
});
