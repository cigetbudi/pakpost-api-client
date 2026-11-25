import test from 'node:test';
import assert from 'node:assert/strict';
import {queueWorkspaceMemberJoined} from '../../src/features/workspace/services/workspaceMemberJoined.js';
const workspaceId='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';
const eventId='33333333-3333-4333-8333-333333333333';
const event={workspaceId,userId,eventId,displayName:'Untrusted'};
function fixture(){
 const scope={workspaceId,token:'session',enabled:true,seen:new Set(),queue:Promise.resolve()};
 const commits=[],notices=[];let calls=0,current=true;
 const version={current:0};
 const options={isCurrent:()=>current,fetchMembers:async()=>{calls++;return [{userId,displayName:'Acha'}]},version,commit:x=>commits.push(x),currentUserId:()=>null,notify:x=>notices.push(x)};
 return {scope,options,commits,notices,calls:()=>calls,stale:()=>{current=false}};
}
test('member join uses authorized member list, refreshes and deduplicates',async()=>{
 const f=fixture();await queueWorkspaceMemberJoined(f.scope,event,f.options);await queueWorkspaceMemberJoined(f.scope,event,f.options);
 assert.equal(f.calls(),1);assert.equal(f.commits.length,1);assert.deepEqual(f.notices,['Acha has joined the workspace']);
});
test('invalid or different workspace event never makes a request',async()=>{
 const f=fixture();for(const e of [{...event,workspaceId:userId},{...event,eventId:'bad'},null])await queueWorkspaceMemberJoined(f.scope,e,f.options);assert.equal(f.calls(),0);
});
test('late response cannot update a switched session',async()=>{
 const f=fixture();f.options.fetchMembers=async()=>{f.stale();return [{userId,displayName:'Acha'}]};await queueWorkspaceMemberJoined(f.scope,event,f.options);assert.deepEqual(f.commits,[]);assert.deepEqual(f.notices,[]);
});
test('permission refresh invalidates older member join response',async()=>{
 const f=fixture();f.options.fetchMembers=async()=>{f.options.version.current++;return [{userId,displayName:'Acha'}]};await queueWorkspaceMemberJoined(f.scope,event,f.options);assert.deepEqual(f.commits,[]);
});
test('failed authorized read and self join never show a misleading toast',async()=>{
 const f=fixture();f.options.fetchMembers=async()=>{throw Error('403')};await queueWorkspaceMemberJoined(f.scope,event,f.options);assert.deepEqual(f.notices,[]);assert.deepEqual(f.commits,[]);
 f.options.fetchMembers=async()=>[{userId,displayName:'Acha'}];f.options.currentUserId=()=>userId;await queueWorkspaceMemberJoined(f.scope,event,f.options);assert.equal(f.commits.length,1);assert.deepEqual(f.notices,[]);
});
test('member removal refreshes the roster without a false join toast',async()=>{
 const f=fixture();f.options.fetchMembers=async()=>[];
 await queueWorkspaceMemberJoined(f.scope,{...event,removed:true},f.options);
 assert.deepEqual(f.commits,[[]]);assert.deepEqual(f.notices,[]);
});
test('late removal notification cannot change a different workspace',async()=>{
 const f=fixture();f.options.fetchMembers=async()=>{f.stale();return []};
 await queueWorkspaceMemberJoined(f.scope,{...event,removed:true},f.options);
 assert.deepEqual(f.commits,[]);
});
