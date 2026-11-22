import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalProfile, createPublicProfile, createSelfHostedProfile, normalizeServerOrigin } from '../../src/platform/connections/connectionProfiles.js';
test('local mode has no server origin and public mode uses fixed origin',()=>{
  assert.equal(createLocalProfile().origin,null);
  assert.equal(createPublicProfile().origin,'https://pakpost.duckdns.org');
});
test('self hosted accepts strict HTTPS origins only',()=>{
  assert.equal(createSelfHostedProfile({id:'office',name:' Office ',origin:'https://api.example.com/'}).origin,'https://api.example.com');
  for(const value of ['http://api.example.com','https://user:pass@api.example.com','https://api.example.com/api','https://api.example.com/?key=secret','file:///tmp/x','https://api.example.com/#token']) {
    assert.throws(()=>normalizeServerOrigin(value),value);
  }
});
