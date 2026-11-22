import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discoverApiDestinations,destinationOrigin} from '../../src/features/requests/services/interceptorDiscovery.js';

const file=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('detects Hoppscotch and Pakpost URL templates without exposing paths',()=>{
  assert.equal(destinationOrigin('<<BaseUrl>>/api/auth',{BaseUrl:'https://internal.example.org:8443/base'}),'https://internal.example.org:8443');
  assert.equal(destinationOrigin('{{BaseUrl}}/token',{BaseUrl:'http://10.99.1.55:6379'}),'http://10.99.1.55:6379');
  assert.equal(destinationOrigin('{{Unknown}}/token',{BaseUrl:'https://example.org'}),'');
});
test('collects deduplicated API origins from open, local and workspace requests',()=>{
  const hosts=discoverApiDestinations({
    url:'{{BaseUrl}}/auth',
    openTabs:[{id:'t1',url:'https://public.example.org/one'}],
    drafts:{t1:{url:'https://public.example.org/two'}},
    localCollections:[{requests:[{url:'<<BaseUrl>>/api/token'},{url:'https://other.example.net/ping'}]}],
    workspaceRequestLists:{a:[{url:'https://other.example.net/get'},{url:'http://127.0.0.1:7171/api'}]},
    localEnvironments:[{variables:[{key:'BaseUrl',value:'https://token.example.org:8443/api',isSecret:false}]}]
  });
  assert.deepEqual(hosts,['http://127.0.0.1:7171','https://other.example.net','https://public.example.org','https://token.example.org:8443']);
});
test('does not reveal header or body secrets or parse URL credentials',()=>{
  const hosts=discoverApiDestinations({
    url:'https://username:secret@internal.example.org/foo',
    openTabs:[{id:'a',url:'https://real.example.org/abc',headers:{Authorization:'Bearer demo'}}],
    localEnvironments:[{variables:[{key:'TOKEN',value:'private-value',isSecret:true},{key:'PASS',value:'https://u:p@bad.example.org/',isSecret:true}]}],
    localCollections:[{requests:[{url:'not-a-url',body:'https://secret.example.org/internal'}]}]
  });
  assert.deepEqual(hosts,['https://real.example.org']);
});
test('resolves nested environment aliases and rejects unresolved template destinations',()=>{
  const origins=discoverApiDestinations({url:'{{ApiUrl}}/v1',localEnvironments:[{variables:[
    {key:'ApiUrl',value:'{{BaseUrl}}/svc'},{key:'BaseUrl',value:'https://api.example.org'}
  ]}]});
  assert.deepEqual(origins,['https://api.example.org']);
});
test('extension requests permissions only after review and a user click',()=>{
  const popup=file('../../../extension/common/popup.js');
  const content=file('../../../extension/common/content.js');
  const app=readWorkbenchSource();
  assert.match(popup,/scanButton.*addEventListener\('click'/s);
  assert.match(popup,/grantSelected.*addEventListener\('click'/s);
  assert.match(popup,/api\.permissions\.request\(\{origins:patterns\}\)/);
  assert.match(popup,/SETTINGS\.allowedDestinations=\[\.\.\.new Set/);
  assert.match(content,/PAKPOST_DISCOVER_HOSTS/);
  assert.match(app,/DISCOVER_HOSTS_REQUEST/);
  assert.match(app,/discoverApiDestinations/);
});
