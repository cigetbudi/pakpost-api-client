import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { api } from '../../src/services/httpClient.js';
import { toRows, prettyJson } from '../../src/utils/workbenchHelpers.js';

const app = readWorkbenchSource();
const pane = readFileSync(new URL('../../src/components/workbench/ResponsePane.jsx', import.meta.url), 'utf8');
const primitives = readFileSync(new URL('../../src/components/ui/WorkbenchPrimitives.jsx', import.meta.url), 'utf8');

test('App delegates rendering of response pane and reusable primitives', () => {
  assert.match(app, /<ResponsePane\b/);
  assert.doesNotMatch(app, /<section className="pp-response-pane">/);
  assert.match(app, /import \{ Dialog \}/);
  const manager=readFileSync(new URL('../../src/features/workspace/components/WorkspaceManager.jsx',import.meta.url),'utf8');
  assert.match(manager,/IconButton/);
  assert.match(manager,/Empty/);
  assert.match(primitives, /role="dialog" aria-modal="true"/);
  assert.match(pane, /readOnly/);
});

test('CodeMirror remains lazy in App; response presenter never imports it', () => {
  assert.match(app, /Editor=\{TextEditor\}/);
  assert.doesNotMatch(pane, /from ['"]@uiw\/react-codemirror/);
  assert.doesNotMatch(pane, /from ['"]\.\.\/\.\.\/features\/Editors/);
});

test('workbench pure helpers remain deterministic', () => {
  assert.deepEqual(toRows({Accept:'application/json'}), [{key:'Accept',value:'application/json'}]);
  assert.equal(prettyJson('{"ok":true}'), '{\n  "ok": true\n}');
  assert.equal(prettyJson('not-json'), 'not-json');
});

test('API client keeps auth header, instance identifier and error parsing', async () => {
  const previous = globalThis.fetch;
  try {
    let request;
    globalThis.fetch = async (url, init) => {
      request = {url,init};
      return {ok:true,status:200,json:async()=>({id:'1'})};
    };
    assert.deepEqual(await api('/api/workspaces/w1/collections','POST',{name:'x'},'jwt-test'),{id:'1'});
    assert.equal(request.init.headers.Authorization,'Bearer jwt-test');
    assert.ok(request.init.headers['X-PakPost-Instance']);
    assert.equal(request.init.body,JSON.stringify({name:'x'}));

    globalThis.fetch = async () => ({ok:false,status:409,json:async()=>({message:'Revision conflict'})});
    await assert.rejects(() => api('/api/workspaces/w1/collections','POST',{name:'x'}), error => error.status===409 && error.message==='Revision conflict');
  } finally { globalThis.fetch = previous; }
});
