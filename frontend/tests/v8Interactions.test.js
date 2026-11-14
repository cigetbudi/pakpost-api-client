import test from 'node:test';
import assert from 'node:assert/strict';
import {splitUrlVariables,currentVariablePrefix,suggestVariables,insertVariable} from '../src/features/urlSuggestions.js';

test('URL syntax marks known variables green and unknown ones missing',()=>{
  const parts=splitUrlVariables('https://{{baseUrl}}/{{missing}}?token={{token}}', {baseUrl:'api.example.com',token:''});
  assert.deepEqual(parts.filter(p=>p.key).map(p=>[p.key,p.type]),[['baseUrl','known'],['missing','missing'],['token','known']]);
});
test('URL autocomplete activates on incomplete {{ and filters names',()=>{
  assert.deepEqual(currentVariablePrefix('https://{{ba',12),{query:'ba',start:8,cursor:12});
  assert.deepEqual(suggestVariables('https://{{ba',12,{baseUrl:'x',basicToken:'y',token:'z'}),['baseUrl','basicToken']);
  assert.deepEqual(suggestVariables('https://test.example.com',24,{baseUrl:'x'}),[]);
});
test('URL variable autocomplete inserts correct braces and caret',()=>{
  assert.deepEqual(insertVariable('https://{{ba/path',12,'baseUrl'),{url:'https://{{baseUrl}}/path',cursor:19});
  assert.deepEqual(insertVariable('https://{{ba}}/path',12,'baseUrl'),{url:'https://{{baseUrl}}/path',cursor:17});
});
test('autocompletion avoids invalid env names and template false positives',()=>{
  assert.equal(currentVariablePrefix('hello {{bad-key',15),null);
  assert.deepEqual(suggestVariables('{{',2,{'bad-key':'x',baseUrl:'y'}),['baseUrl']);
  assert.deepEqual(splitUrlVariables('plain {{no end',{a:1}),[{text:'plain {{no end',type:'plain'}]);
});
