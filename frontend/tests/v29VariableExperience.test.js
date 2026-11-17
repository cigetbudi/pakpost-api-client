import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isSensitiveVariable,variableDescriptors,putEnvironmentVariable} from '../src/features/variableExperience.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('resolved, missing and restricted variables keep the existing URL status semantics',()=>{
  const parts=variableDescriptors('{{baseUrl}}/api/{{token}}/{{unknown}}/{{blocked}}',
    {baseUrl:'https://service.example.com',token:'secret-value'},
    [{key:'baseUrl',value:'https://service.example.com'}, {key:'token',isSecret:true}, {key:'blocked',isRedacted:true}]);
  assert.deepEqual(parts.filter(x=>x.key).map(x=>[x.key,x.type]),[
    ['baseUrl','known'],['token','known'],['unknown','missing'],['blocked','restricted']]);
  assert.equal(parts.find(x=>x.key==='token').sensitive,true);
});

test('token/password/key heuristic masks even post-script tokens not flagged secret',()=>{
  for(const name of ['token','access_token','AuthToken','password','apiKey','clientSecret','bearerToken'])
    assert.equal(isSensitiveVariable(name),true,name);
  assert.equal(isSensitiveVariable('baseUrl'),false);
  assert.equal(isSensitiveVariable('page'),false);
});

test('quick edit updates exactly one environment variable and preserves isSecret',()=>{
  const original=[{key:'baseUrl',value:'https://old',isSecret:false},{key:'token',value:'old',isSecret:true}];
  const changed=putEnvironmentVariable(original,'token','new');
  assert.deepEqual(changed[0],original[0]);
  assert.deepEqual(changed[1],{key:'token',value:'new',isSecret:true});
  assert.equal(original[1].value,'old');
});

test('quick create supports missing variables and safeguards redacted variables',()=>{
  const next=putEnvironmentVariable([], 'AuthToken','abc');
  assert.deepEqual(next,[{key:'AuthToken',value:'abc',isSecret:true}]);
  assert.throws(()=>putEnvironmentVariable([{key:'token',isRedacted:true}], 'token','abc'),/Restricted/);
  assert.throws(()=>putEnvironmentVariable([], 'bad key','abc'),/Invalid/);
});

test('URL, param/header, authorization, form data and raw body share variable support',()=>{
  const app=read('../src/App.jsx');
  const kv=read('../src/features/KeyValueEditor.jsx');
  const url=read('../src/features/VariableUrlInput.jsx');
  const cm=read('../src/features/Editors.jsx');
  assert.match(app,/<VariableUrlInput[^\n]*\{\.\.\.variableUi\}/);
  assert.match(app,/<KeyValueEditor kind="params"[^\n]*variableUi=\{variableUi\}/);
  assert.match(app,/<KeyValueEditor kind="headers"[^\n]*variableUi=\{variableUi\}/);
  assert.match(app,/ariaLabel="Bearer token"/);
  assert.match(read('../src/features/requests/components/RequestBody.jsx'),/ariaLabel="Form field value"/);
  assert.match(kv,/VariableAwareInput/);
  assert.match(url,/VariableAwareInput/);
  assert.match(cm,/codeMirrorVariableDecoration/);
});

test('security: secret previews are masked by default; edits reuse the active environment API',()=>{
  const visual=read('../src/features/VariableAwareInput.jsx');
  const app=read('../src/App.jsx');
  assert.match(visual,/item\.sensitive&&!revealed/);
  assert.match(visual,/masked\?'••••••••••••'/);
  assert.match(app,/const variables=putEnvironmentVariable\(activeEnvironment\.variables,key,value\)/);
  assert.match(app,/await persistEnvironment\(\{\.\.\.activeEnvironment,variables\}\)/);
  assert.match(app,/contains restricted variables/);
});
