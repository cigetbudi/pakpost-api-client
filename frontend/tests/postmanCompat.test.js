import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { postmanRequestSnapshot } from '../src/features/postmanCompat.js';

test('pm.request.url.path excludes hostname, query, and fragment', () => {
  const request = postmanRequestSnapshot({
    method: 'POST',url: 'https://api.example.test/api/withdrawal?debug=1#info',
    body: '{"amount":100000}',format:'application/json',headers:{'X-Env':'DEV'},
  });
  assert.deepEqual(request.url.path,['api','withdrawal']);
  assert.equal(request.method,'POST');
  assert.equal(request.body.raw,'{"amount":100000}');
});

test('pm.request.url.path resolves environment base URL', () => {
  const request = postmanRequestSnapshot({
    method: 'GET',url:'{{baseUrl}}/api/auth?x=1',body:'',format:'none',headers:{},
  },{baseUrl:'https://api.example.test'});
  assert.deepEqual(request.url.path,['api','auth']);
  assert.equal(request.body,null);
});

test('signature payload shape matches HMAC-SHA256 Base64 reference', () => {
  // Golden output from Node's built-in crypto for comparison in browser with crypto-js.
  const timestamp='2026-11-14T07:00:00.000Z';
  const token='fake-token';
  const secret='test-secret-not-real';
  const body='{"amount":100000}';
  const path='/api/withdrawal';
  const message=`path=${path}&verb=POST&token=Bearer ${token}&timestamp=${timestamp}&body=${body}`;
  const signature=createHmac('sha256',secret).update(message,'utf8').digest('base64');
  assert.equal(signature,'gTzxZBXVdGNlndupUCEuaq6GJo3QCmuq8XNaIMus1+4=');
});
