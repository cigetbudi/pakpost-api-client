import test from 'node:test';
import assert from 'node:assert/strict';
import {parseImportText} from '../src/features/importExport.js';
import {parseEnvironmentDocument,uniqueEnvironmentImports} from '../src/features/environmentImport.js';
import {normalizeHoppscotchVariables} from '../src/features/hoppscotchCompat.js';

const hoppscotchEnv={
  id:'test-env',v:2,name:'Sample [DEV]',variables:[
    {key:'BaseUrl',initialValue:'https://api.example.test',currentValue:'',secret:false},
    {key:'AuthToken',initialValue:'{{otherToken}}',currentValue:'',secret:true},
    {key:'NoHp',initialValue:'',currentValue:'<<Phone>>',secret:false},
    {key:'Empty',initialValue:'',currentValue:'',secret:false}
  ]
};

test('Hoppscotch v2 environment JSON imports initialValue fallback and secret flag',()=>{
  const parsed=parseImportText(JSON.stringify(hoppscotchEnv));
  assert.equal(parsed.kind,'environment');
  assert.equal(parsed.environments.length,1);
  const env=parsed.environments[0];
  assert.equal(env.name,'Sample [DEV]');
  assert.equal(env.variables.find(v=>v.key==='BaseUrl').value,'https://api.example.test');
  assert.equal(env.variables.find(v=>v.key==='AuthToken').isSecret,true);
  assert.equal(env.variables.find(v=>v.key==='NoHp').value,'{{Phone}}');
  assert.equal(env.variables.find(v=>v.key==='Empty').value,'');
});

test('Normalize Hoppscotch placeholders safely and case-sensitively',()=>{
  assert.equal(normalizeHoppscotchVariables('<<BaseUrl>>/api/<<Session>>'),'{{BaseUrl}}/api/{{Session}}');
  assert.equal(normalizeHoppscotchVariables('<tag attr="x">text</tag>'),'<tag attr="x">text</tag>');
  assert.equal(normalizeHoppscotchVariables('abc <<invalid name>> foo'),'abc <<invalid name>> foo');
  assert.equal(normalizeHoppscotchVariables('{{BaseUrl}}'), '{{BaseUrl}}');
});

test('Hoppscotch OpenAPI server, request body, parameters, and dropped requests are normalized',()=>{
  const doc={openapi:'3.1.0',info:{title:'Test',version:'1'},servers:[{url:'<<BaseUrl>>'}],
    paths:{'/api/check/{NoHp}':{post:{summary:'Check',parameters:[{name:'NoHp',in:'path',required:true,schema:{type:'string'}},
      {name:'X-Session',in:'header',example:'<<Session>>'}],
      requestBody:{content:{'application/json':{example:{phone:'<<NoHp>>',session:'<<Session>>'}}}},
      responses:{'200':{description:'OK'}}}}},
    'x-hoppscotch-dropped-requests':[{request:{name:'Legacy',method:'GET',endpoint:'<<BaseUrl>>/api/legacy/<<Session>>',headers:[],params:[]}}]
  };
  const parsed=parseImportText(JSON.stringify(doc));
  assert.equal(parsed.kind,'openapi');
  assert.equal(parsed.requests.length,2);
  assert.equal(parsed.requests[0].url,'{{BaseUrl}}/api/check/{{NoHp}}');
  assert.equal(parsed.requests[0].rows[0].value,'{{Session}}');
  assert.deepEqual(JSON.parse(parsed.requests[0].body),{phone:'{{NoHp}}',session:'{{Session}}'});
  assert.equal(parsed.requests[1].url,'{{BaseUrl}}/api/legacy/{{Session}}');
});

test('Postman environment and Insomnia v4 environment imports remain compatible',()=>{
  const pm={name:'Postman Dev',values:[{key:'baseUrl',value:'https://postman.example',enabled:true,type:'default'},
    {key:'secret',value:'private',enabled:true,type:'secret'},{key:'disabled',value:'x',enabled:false}]};
  const env=parseEnvironmentDocument(pm)[0];
  assert.equal(env.variables.length,2);
  assert.equal(env.variables[1].isSecret,true);
  const insomnia={_type:'export',__export_format:4,resources:[
    {_id:'wk',_type:'workspace',name:'Test'},
    {_id:'env',_type:'environment',name:'Dev',parentId:'wk',data:{baseUrl:'https://insomnia.example',token:'{{ _.token }}'}}
  ]};
  const parsed=parseImportText(JSON.stringify(insomnia));
  assert.equal(parsed.kind,'environment');
  assert.equal(parsed.environments[0].variables.length,2);
  assert.equal(parsed.environments[0].variables[1].value,'{{token}}');
});

test('Insomnia combined export still imports HTTP requests and environments together',()=>{
  const doc={_type:'export',__export_format:4,resources:[
    {_id:'wk',_type:'workspace',name:'Test'},
    {_id:'env',_type:'environment',name:'Dev',parentId:'wk',data:{baseUrl:'https://api.example.test'}},
    {_id:'req',_type:'request',parentId:'wk',name:'Get',method:'GET',url:'{{ _.baseUrl }}/api',headers:[]}
  ]};
  const result=parseImportText(JSON.stringify(doc));
  assert.equal(result.kind,'insomnia');
  assert.equal(result.requests.length,1);
  assert.equal(result.environments.length,1);
});

test('Unique name collision suffixes without overwriting existing environments',()=>{
  const renamed=uniqueEnvironmentImports([{name:'Dev',variables:[]},{name:'Dev',variables:[]}],[{name:'DEV'}]);
  assert.deepEqual(renamed.map(x=>x.name),['Dev (2)','Dev (3)']);
});

test('Invalid duplicate and unsafe variable names are rejected before import',()=>{
  assert.throws(()=>parseEnvironmentDocument({v:2,name:'Test',variables:[{key:'foo',initialValue:'1'},{key:'FOO',initialValue:'2'}]}),/Duplicate variable/);
  assert.throws(()=>parseEnvironmentDocument({v:2,name:'Test',variables:[{key:'bad key',initialValue:'1'}]}),/Unsupported variable/);
});

test('OpenAPI environment vendor extension round trips',()=>{
  const doc={openapi:'3.1.0',info:{title:'Environment',version:'1'},paths:{},'x-pakpost-environment':{
    name:'Dev',variables:[{key:'BaseUrl',value:'https://api.example.test',secret:false}]
  }};
  const parsed=parseImportText(JSON.stringify(doc));
  assert.equal(parsed.kind,'environment');
  assert.equal(parsed.environments[0].variables[0].key,'BaseUrl');
});
