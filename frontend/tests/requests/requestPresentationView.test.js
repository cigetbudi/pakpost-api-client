import test from 'node:test';
import assert from 'node:assert/strict';
import {requestResponseView} from '../../src/features/requests/services/requestResponseView.js';

test('response view exposes no body for network errors or missing responses',()=>{
  assert.deepEqual(requestResponseView(null,'body',false,''),{responseType:'text/plain',responseText:''});
  assert.deepEqual(requestResponseView({error:'Network error',body:'private'},'body',false,''),
    {responseType:'text/plain',responseText:''});
});

test('response view preserves raw and formatted body and headers panels',()=>{
  const response={body:'{"ok":true}',headers:{'Content-Type':'application/json'}};
  assert.equal(requestResponseView(response,'body',false,'').responseText,'{"ok":true}');
  assert.equal(requestResponseView(response,'body',true,'custom format').responseText,'custom format');
  assert.match(requestResponseView(response,'headers',false,'').responseText,/Content-Type/);
  assert.equal(requestResponseView(response,'body',false,'').responseType,'application/json');
});
