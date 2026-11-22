import test from 'node:test';
import assert from 'node:assert/strict';
import * as facade from '../../src/features/import-export/services/importExport.js';
import {blankDraft} from '../../src/features/import-export/services/draftFormat.js';
import {parseCurl} from '../../src/features/import-export/services/curlImport.js';
import {parsePostmanCollection,postmanFolderDocs} from '../../src/features/import-export/services/postmanImport.js';
import {safeExportDraft,createPostmanCollection,createLocalPostmanExport} from '../../src/features/import-export/services/postmanExport.js';
import {parseSession,createSessionExport} from '../../src/features/import-export/services/sessionFormats.js';

test('import/export public facade keeps the same functions after modularization',()=>{
  assert.equal(facade.blankDraft,blankDraft);
  assert.equal(facade.parseCurl,parseCurl);
  assert.equal(facade.parsePostmanCollection,parsePostmanCollection);
  assert.equal(facade.postmanFolderDocs,postmanFolderDocs);
  assert.equal(facade.safeExportDraft,safeExportDraft);
  assert.equal(facade.createPostmanCollection,createPostmanCollection);
  assert.equal(facade.createLocalPostmanExport,createLocalPostmanExport);
  assert.equal(facade.parseSession,parseSession);
  assert.equal(facade.createSessionExport,createSessionExport);
});

test('Postman roundtrip retains folder paths, script bodies and auth placeholders',()=>{
  const input={info:{name:'Banking API'},item:[{name:'ATM',item:[{
    name:'Withdraw',request:{method:'POST',url:'https://example.com/withdraw',
      header:[{key:'Authorization',value:'Bearer {{token}}'}],body:{mode:'raw',raw:'{"amount":100}',options:{raw:{language:'json'}}}},
    event:[{listen:'prerequest',script:{exec:['pm.variables.set("t", "1");']}}],
  }]}]};
  const requests=facade.parsePostmanCollection(input);
  assert.deepEqual(requests[0].folderPath,['ATM']);
  assert.equal(requests[0].preScript,'pm.variables.set("t", "1");');
  assert.equal(requests[0].body,'{"amount":100}');
  const exported=facade.createLocalPostmanExport([{name:'API',requests}]);
  const again=facade.parsePostmanCollection({info:{name:'API'},item:exported.item[0].item});
  assert.deepEqual(again[0].folderPath,['ATM']);
  assert.equal(again[0].body,'{"amount":100}');
});

test('portable and session exports redact credentials without mutating editor draft',()=>{
  const draft={...facade.blankDraft(),method:'GET',url:'https://example.com',
    rows:[{key:'Authorization',value:'Bearer real-secret',enabled:true}],
    bearerToken:'real-secret',basicPassword:'private-password',apiKeyValue:'api-secret'};
  const exported=facade.safeExportDraft(draft);
  assert.equal(exported.rows[0].value,'{{REDACTED}}');
  assert.equal(exported.bearerToken,'{{REDACTED}}');
  assert.equal(exported.basicPassword,'{{REDACTED}}');
  assert.equal(exported.apiKeyValue,'{{REDACTED}}');
  assert.equal(draft.rows[0].value,'Bearer real-secret');
  const portable=facade.createSessionExport([draft],[]);
  assert.deepEqual(facade.parseSession(portable).requests[0].rows,exported.rows);
});

test('cURL parser still rejects unsupported flags and never runs a shell',()=>{
  assert.equal(facade.parseCurl('curl https://example.com').method,'GET');
  assert.throws(()=>facade.parseCurl('curl --output /tmp/out https://example.com'),/Unsupported cURL flag/);
  assert.throws(()=>facade.parseCurl('curl --url'),/Missing value/);
});
