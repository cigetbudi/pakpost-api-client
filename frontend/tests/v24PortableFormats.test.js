import test from 'node:test';
import assert from 'node:assert/strict';
import {parseImportText} from '../src/features/importExport.js';
import {exportCollectionByFormat,exportOpenApiCollection,flattenLocalCollections,exportEnvironmentByFormat,exportFileName} from '../src/features/exportFormats.js';
import {exportInsomniaV4Collection,parseInsomniaV4,parseOpenApiCollection} from '../src/features/portableFormats.js';

const request={name:'Create Token',requestName:'Create Token',method:'POST',url:'https://api.example.test/v1/tokens',
  folderPath:['Auth'],documentation:'Create a token for a customer',
  format:'application/json',body:'{"customer":"C-001","amount":5000}',
  rows:[{key:'X-Client',value:'Pakpost',description:'Client name',enabled:true},{key:'X-Off',value:'no',enabled:false}],
  params:[{key:'debug',value:'yes',description:'Debug request',enabled:false}],preScript:'pm.variables.set("foo", "1")',
  responseExamples:[{id:'ok',statusCode:200,name:'Success',reasonPhrase:'OK',headers:{'Content-Type':'application/json'},
    body:'{"responseCode":"00"}',contentType:'application/json'},{id:'fail',statusCode:400,name:'Failed - Invalid Amount',reasonPhrase:'Bad Request',
    headers:{'Content-Type':'application/json'},body:'{"responseCode":"02"}',contentType:'application/json'}]};

test('OpenAPI 3.1 JSON becomes Local Collection with server, docs, query/header, body and response examples',()=>{
  const spec={openapi:'3.1.0',info:{title:'Bank Test API',version:'1.0.0',description:'Sample documentation'},
    servers:[{url:'https://api.example.test'}],tags:[{name:'Cash / Withdrawal',description:'Withdrawal API folder'}],
    components:{securitySchemes:{bearer:{type:'http',scheme:'bearer'}}},
    paths:{'/v1/withdrawal/{transactionId}':{post:{summary:'Withdraw',description:'Transfer funds',tags:['Cash / Withdrawal'],
      security:[{bearer:[]}],parameters:[{name:'transactionId',in:'path',required:true,schema:{type:'string'}},
      {name:'merchant',in:'query',description:'Merchant ID',schema:{type:'string'},example:'M-1'},
      {name:'X-Client',in:'header',description:'Client channel',schema:{type:'string'},example:'WEB'}],
      requestBody:{content:{'application/json':{schema:{type:'object'},example:{amount:10000,currency:'IDR'}}}},
      responses:{'200':{description:'Success',content:{'application/json':{examples:{ok:{summary:'Success',value:{code:'00'}}}}}},
        '401':{description:'Invalid signature',content:{'application/json':{example:{code:'41'}}}}}
    }}}};
  const parsed=parseImportText(JSON.stringify(spec));
  assert.equal(parsed.kind,'openapi');
  assert.equal(parsed.collections[0].name,'Bank Test API');
  assert.equal(parsed.collections[0].folderDocs['["Cash","Withdrawal"]'],'Withdrawal API folder');
  const [req]=parsed.requests;
  assert.equal(req.method,'POST');
  assert.equal(req.url,'https://api.example.test/v1/withdrawal/{{transactionId}}');
  assert.equal(req.documentation,'Transfer funds');
  assert.equal(req.authType,'bearer');
  assert.equal(req.params[0].value,'M-1');
  assert.equal(req.rows[0].value,'WEB');
  assert.deepEqual(JSON.parse(req.body),{amount:10000,currency:'IDR'});
  assert.deepEqual(req.responseExamples.map(x=>x.statusCode),[200,401]);
});

test('OpenAPI 3.1 export/import restores body, saved 200/400 examples, request and folder documentation',()=>{
  const exported=exportCollectionByFormat([request],{format:'openapi',name:'Bank API',documentation:'Bank docs',folderDocs:{'["Auth"]':'Authentication flows'}});
  assert.equal(exported.openapi,'3.1.0');
  assert.equal(exported.paths['/v1/tokens'].post.requestBody.content['application/json'].example.customer,'C-001');
  const imported=parseImportText(JSON.stringify(exported));
  assert.equal(imported.kind,'openapi');
  assert.equal(imported.requests[0].name,request.name);
  assert.deepEqual(JSON.parse(imported.requests[0].body),JSON.parse(request.body));
  assert.equal(imported.requests[0].responseExamples.length,2);
  assert.equal(imported.collections[0].folderDocs['["Auth"]'],'Authentication flows');
});

test('Insomnia v4 export/import maps folders, enabled flags and body without executing script',()=>{
  const exported=exportInsomniaV4Collection([request],{name:'Test Collection',documentation:'Bank documentation',folderDocs:{'["Auth"]':'Auth docs'}});
  assert.equal(exported.__export_format,4);
  assert.equal(exported.resources.find(x=>x._type==='request_group').description,'Auth docs');
  const imported=parseImportText(JSON.stringify(exported));
  assert.equal(imported.kind,'insomnia');
  assert.equal(imported.collections[0].name,'Test Collection');
  const [req]=imported.requests;
  assert.equal(req.method,'POST');
  assert.equal(req.rows[1].enabled,false);
  assert.equal(req.params[0].enabled,false);
  assert.equal(req.body,request.body);
  assert.equal(req.preScript,'');
  assert.equal(imported.collections[0].folderDocs['["Auth"]'],'Auth docs');
});

test('Insomnia legacy JSON import converts {{ _.variable }} into Pakpost variables',()=>{
  const doc={_type:'export',__export_format:4,resources:[
    {_id:'wrk_1',_type:'workspace',name:'Insomnia project',parentId:null},
    {_id:'fld_1',_type:'request_group',parentId:'wrk_1',name:'Account'},
    {_id:'req_1',_type:'request',parentId:'fld_1',name:'Get account',method:'GET',url:'{{ _.base_url }}/accounts/{{ _.accountId }}',headers:[{name:'X-Token',value:'{{ _.token }}'}],parameters:[]}
  ]};
  const parsed=parseInsomniaV4(doc);
  assert.equal(parsed.requests[0].url,'{{base_url}}/accounts/{{accountId}}');
  assert.equal(parsed.requests[0].rows[0].value,'{{token}}');
  assert.deepEqual(parsed.requests[0].folderPath,['Account']);
});

test('Insomnia environment export redacts secret and can be re-imported',()=>{
  const env={name:'Prod',variables:[{key:'apiKey',value:'very-secret',isSecret:true},{key:'baseUrl',value:'https://api.example.com',isSecret:false}]};
  const exported=exportEnvironmentByFormat(env,{format:'insomnia'});
  assert.equal(exported.__export_format,4);
  const imported=parseImportText(JSON.stringify(exported));
  assert.equal(imported.environments[0].variables.find(x=>x.key==='apiKey').value,'');
  assert.equal(imported.environments[0].variables.find(x=>x.key==='baseUrl').value,'https://api.example.com');
  assert.match(exportFileName('example','insomnia'),/insomnia_v4\.json$/);
});

test('OpenAPI rejects remote $ref resolution and prevents oversized import',()=>{
  const imported=parseOpenApiCollection({openapi:'3.1.0',info:{title:'Ref Test'},paths:{'/one':{get:{summary:'Test',requestBody:{$ref:'https://example.test/secret.json'},responses:{default:{description:'OK'}}}}}});
  assert.equal(imported.requests.length,1);
  assert.equal(imported.requests[0].body,'');
  assert.throws(()=>parseOpenApiCollection({openapi:'2.0.0',info:{title:'Invalid'},paths:{}}),/OpenAPI/);
  assert.throws(()=>parseImportText('openapi: 3.1.0\ninfo:\n  title: Test\n'),/YAML/);
});

test('Multiple local collections flatten into stable tags for OpenAPI and Insomnia',()=>{
  const local=[{name:'Payments',documentation:'Payment docs',folderDocs:{'["Auth"]':'Auth docs'},requests:[request]},
    {name:'Products',requests:[{...request,name:'List Products',requestName:'List Products',method:'GET',url:'https://api.example.test/v1/products',folderPath:[],body:'',responseExamples:[]}]}];
  const flat=flattenLocalCollections(local);
  assert.deepEqual(flat.requests[0].folderPath,['Payments','Auth']);
  assert.equal(flat.folderDocs['["Payments","Auth"]'],'Auth docs');
  const doc=exportOpenApiCollection(flat.requests,{name:'Local',folderDocs:flat.folderDocs});
  assert.equal(doc.paths['/v1/tokens'].post.tags[0],'Payments / Auth');
  const ins=exportInsomniaV4Collection(flat.requests,{name:'Local',folderDocs:flat.folderDocs});
  assert.equal(ins.resources.filter(x=>x._type==='request_group').length,3);
});
