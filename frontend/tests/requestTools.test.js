import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveVars,syntaxProblem,buildCommand,generateCode} from '../src/features/requestTools.js';
test('resolve nested environment placeholders',()=>{
  assert.equal(resolveVars('{{baseUrl}}/users', {baseUrl:'https://api.example.test'}).value,'https://api.example.test/users');
  assert.equal(resolveVars('<<baseURL>>', {baseURL:'https://api.example.test'}).value,'https://api.example.test');
  assert.throws(()=>resolveVars('{{missing}}',{}),/Unresolved environment/);
});
test('JSON validation flags invalid input but permits templates',()=>{
  assert.equal(syntaxProblem('{"token":"{{accessToken}}"}', 'json'),null);
  assert.ok(syntaxProblem('{"broken":', 'json'));
});
test('build raw request with environment',()=>{
  const command=buildCommand({method:'POST',url:'{{baseUrl}}/v1',headers:[{key:'X-Client',value:'{{client}}'}],body:'{"name":"{{name}}"}',format:'application/json'},
    {baseUrl:'https://api.example.test',client:'web',name:'Pakpost'});
  assert.equal(command.url,'https://api.example.test/v1');
  assert.equal(command.headers['Content-Type'],'application/json');
  assert.equal(command.body,'{"name":"Pakpost"}');
  assert.equal(command.headers['X-Client'],'web');
});
test('cURL generator does not duplicate data-raw',()=>{
  const code=generateCode({method:'POST',url:'https://example.test',headers:{},body:'hello',bodyMode:'raw'},'curl');
  assert.equal(code.match(/--data-raw/g)?.length,1);
});
