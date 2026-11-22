import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionExampleActions } from '../../src/features/collections/controllers/createCollectionExampleActions.js';
import { createWorkspaceCollectionMenuActions } from '../../src/features/collections/controllers/createWorkspaceCollectionMenuActions.js';

test('response example synchronization preserves an unsaved parent request body',()=>{
  const draftsRef={current:{t1:{body:'my unsaved body',method:'POST'}}};
  const rendered=[];
  const actions=createCollectionExampleActions({
    activeTabRef:{current:'t1'},
    openTabs:[{id:'t1',source:{scope:'local',collectionId:'c1',requestId:'r1'}}],
    draftsRef,snapshot:()=>({body:'my unsaved body',method:'POST'}),
    setResponseExamples:examples=>rendered.push(examples),
  });
  const examples=[{id:'e1',name:'Success',statusCode:200}];
  actions.synchronizeSavedExamples('local','', 'c1','r1',examples);
  assert.equal(draftsRef.current.t1.body,'my unsaved body');
  assert.equal(draftsRef.current.t1.method,'POST');
  assert.deepEqual(draftsRef.current.t1.responseExamples,examples);
  assert.deepEqual(rendered,[examples]);
});

test('workspace context-menu new request stays scoped to its collection',async()=>{
  let closed,created;
  const actions=createWorkspaceCollectionMenuActions({
    selectedWs:'w1',setWorkspaceMenu:value=>{closed=value},
    createCollectionDraft:(scope,col)=>{created=[scope,col]},
  });
  await actions.handleWorkspaceMenu('newRequest',{collectionId:'c2'});
  assert.equal(closed,null);
  assert.deepEqual(created,['workspace','c2']);
});

test('workspace draft restores stored request metadata without mutating it',()=>{
  const headers=[{key:'X-Test',value:'some-value'}];
  const meta={headers,params:[],documentation:'example',responseExamples:[],auth:{authType:'none'}};
  const actions=createWorkspaceCollectionMenuActions({
    EMPTY_HEADER:{key:'',value:'',enabled:true},blankDraft:()=>({method:'GET'}),
    decodeStoredHeaders:()=>meta,
  });
  const draft=actions.workspaceDraft({id:'r1',name:'test',headersJson:'{}',formFieldsJson:'[]',contentType:'application/json'});
  assert.equal(draft.id,'r1');
  assert.equal(draft.documentation,'example');
  assert.equal(draft.rows.length,2);
  assert.deepEqual(headers,[{key:'X-Test',value:'some-value'}]);
});
