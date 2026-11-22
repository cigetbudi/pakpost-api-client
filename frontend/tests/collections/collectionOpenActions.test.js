import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectionActions} from '../../src/features/collections/controllers/createCollectionActions.js';
import {createCollectionOpenActions} from '../../src/features/collections/controllers/createCollectionOpenActions.js';

test('opening a previously bound request focuses its tab instead of duplicating it',()=>{
  const focused=[];const added=[];
  const actions=createCollectionOpenActions({
    openTabs:[{id:'t1',name:'Original'}],
    findBoundTab:()=>({id:'t1'}), selectTab:id=>focused.push(id),
    addTab:(...args)=>added.push(args),
  });
  actions.openBoundRequest({id:'req'}, {scope:'local',requestId:'req'});
  assert.deepEqual(focused,['t1']);
  assert.deepEqual(added,[]);
});

test('workspace example can still use workspaceDraft from the Cloud menu factory after splitting',()=>{
  const tabs=[];const requests=[];
  const activeTabRef={current:'t0'};
  const draftsRef={current:{}};
  let result=null;
  const deps={
    selectedWs:'workspace-1',EMPTY_HEADER:{key:'',value:''},
    blankDraft:()=>({method:'GET',url:'https://example.test'}),
    decodeStoredHeaders:()=>({headers:[],params:[],documentation:'docs',responseExamples:[],auth:{authType:'none'}}),
    findBoundTab:()=>null,openTabs:[],activeTabRef,draftsRef,
    addTab:(draft,source)=>{
      activeTabRef.current='t2';draftsRef.current.t2=draft;
      requests.push({draft,source});
    },
    exampleToResult:()=>({statusCode:201,body:'Created'}),
    setResult:value=>{result=value;},setResTab:()=>{},
    setOpenTabs:next=>{if(typeof next==='function')next(tabs);},
  };
  const actions=createCollectionActions(deps);
  actions.openWorkspaceExample({id:'request-1',name:'Create',headersJson:'{}',formFieldsJson:'[]',revision:4},'collection-1',{id:'example-1'});
  assert.equal(requests.length,1);
  assert.equal(requests[0].draft.method,'GET');
  assert.equal(requests[0].draft.documentation,'docs');
  assert.equal(requests[0].source.workspaceId,'workspace-1');
  assert.equal(requests[0].source.requestId,'request-1');
  assert.equal(result.statusCode,201);
});
