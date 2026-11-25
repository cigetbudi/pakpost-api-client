import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCurl} from '../../src/features/import-export/services/curlImport.js';
import {activeTabScrollDelta} from '../../src/features/requests/services/tabActions.js';
test('scheme-less curl targets default to https and preserve query parameters',()=>{
 const r=parseCurl("curl -X GET 'fakestoreapi.com/products/1?test=yes'");assert.equal(r.url,'https://fakestoreapi.com/products/1');assert.equal(r.method,'GET');assert.equal(r.params[0].value,'yes');
 assert.equal(parseCurl('curl --url=localhost:8080/test').url,'https://localhost:8080/test');assert.equal(parseCurl("curl '[::1]:8080/test'").url,'https://[::1]:8080/test');
});
test('explicit HTTP and environment placeholder remain unchanged',()=>{
 assert.equal(parseCurl('curl http://example.com/test').url,'http://example.com/test');assert.equal(parseCurl("curl '{{baseUrl}}/test'").url,'{{baseUrl}}/test');
});
test('non-HTTP and relative URLs are rejected rather than rewritten',()=>{
 for(const url of ['ftp://example.com','file:///etc/passwd','javascript:alert(1)','/api/items','//example.com','example.com:99999','user@example.com','http:/example.com'])assert.throws(()=>parseCurl(`curl '${url}'`));
});
test('tab strip reveals active tab and plus where space permits',()=>{
 const bounds={left:0,right:300};assert.equal(activeTabScrollDelta(bounds,{left:500,right:650},{right:690}),390);assert.equal(activeTabScrollDelta(bounds,{left:-90,right:60}),-90);assert.equal(activeTabScrollDelta(bounds,{left:50,right:180}),0);assert.equal(activeTabScrollDelta(bounds,{left:250,right:500},{right:540}),240);
});
