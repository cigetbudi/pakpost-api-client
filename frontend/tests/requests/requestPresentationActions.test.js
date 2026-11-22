import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestPresentationActions} from '../../src/features/requests/controllers/createRequestPresentationActions.js';

const base={
  method:'POST',url:'https://example.test',rows:[],params:[],body:'{}',format:'application/json',
  formFields:[],binaryFile:{name:'',base64:''},currentAuth:()=>({authType:'none'}),
  varsFromEnv:allowSecrets=>({SECRET:allowSecrets?'private-value':'[REDACTED]'}),
};

test('code request preview uses redacted variables by default, preserving explicit private preview option',()=>{
  let redacted=null,vars=null;
  const actions=createRequestPresentationActions({
    ...base,
    buildRedactedCodeRequest:input=>{redacted=input;return {mode:'redacted'};},
    buildRequestCommand:(_request,variableMap)=>{vars=variableMap;return {mode:'private'};},
    buildRequestPreview:request=>request,
  });
  assert.deepEqual(actions.buildCodeRequest(),{mode:'redacted'});
  assert.equal(redacted.variableMap.SECRET,'[REDACTED]');
  assert.equal(redacted.allVariableMap.SECRET,'[REDACTED]');
  assert.equal(redacted.request.auth.authType,'none');
  assert.deepEqual(actions.buildCodeRequest(true),{mode:'private'});
  assert.equal(vars.SECRET,'private-value');
  assert.equal(actions.codePreviewRequest().method,'POST');
});

test('JSON comment protection stops a destructive Beautify and keeps the original body',async()=>{
  let setBodyCalls=0,notice='';
  const actions=createRequestPresentationActions({
    ...base,body:'// comments\n{"ok":true}',
    languageFromMime:()=> 'json',hasJsonComments:()=>true,
    formatSource:async()=> '{}',
    setBody:()=>{setBodyCalls++;},setNotice:value=>{notice=value;},
    getMessage:error=>error.message,
  });
  await actions.beautifyBody();
  assert.equal(setBodyCalls,0);
  assert.match(notice,/Remove JSON comments/);
});
