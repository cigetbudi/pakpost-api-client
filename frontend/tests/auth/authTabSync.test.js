import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthTabSync,sessionFingerprint} from '../../src/features/auth/services/authTabSync.js';

function harness(){
  const channels=new Set();
  class FakeChannel {
    constructor(name){this.name=name;this.onmessage=null;channels.add(this);}
    postMessage(data){for(const peer of channels) if(peer!==this&&peer.name===this.name) peer.onmessage?.({data});}
    close(){channels.delete(this);}
  }
  let seq=0;
  const create=(state)=>createAuthTabSync({Channel:FakeChannel,makeId:()=>`id-${++seq}`,
    getToken:()=>state.token,acceptToken:token=>{state.token=token;state.adopted++;},
    onRemoteLogout:()=>{state.token='';state.loggedOut++;}});
  return {create,channels};
}
const state=(token='')=>({token,adopted:0,loggedOut:0});

test('a new tab joins an already signed-in tab without localStorage',()=>{
  const {create}=harness(),a=state('valid-jwt'),b=state();
  const first=create(a),second=create(b);
  second.requestSession();
  assert.equal(b.token,'valid-jwt');assert.equal(b.adopted,1);
  first.close();second.close();
});

test('sign-in after a second tab opens notifies the waiting tab',()=>{
  const {create}=harness(),a=state(),b=state();
  const first=create(a),second=create(b);
  second.requestSession();assert.equal(b.token,'');
  a.token='new-jwt';first.announceSession();
  assert.equal(b.token,'new-jwt');
  first.close();second.close();
});

test('logout propagates only to tabs sharing that session',()=>{
  const {create}=harness(),a=state('shared'),b=state('shared'),c=state('another');
  const first=create(a),second=create(b),third=create(c);
  first.announceLogout(a.token);a.token='';
  assert.equal(b.token,'');assert.equal(b.loggedOut,1);
  assert.equal(c.token,'another');assert.equal(c.loggedOut,0);
  first.close();second.close();third.close();
});

test('an authenticated tab ignores other tabs session offer',()=>{
  const {create}=harness(),a=state('one'),b=state('two');
  const first=create(a),second=create(b);
  first.announceSession();second.requestSession();
  assert.equal(b.token,'two');assert.equal(b.adopted,0);
  first.close();second.close();
});

test('responses are addressed to a specific tab and nonce',()=>{
  const {create}=harness(),a=state('origin'),b=state(),c=state();
  const first=create(a),second=create(b),third=create(c);
  second.requestSession();assert.equal(b.adopted,1);assert.equal(c.adopted,0);
  first.close();second.close();third.close();
});

test('sign-out does not broadcast the raw bearer token',()=>{
  const {create,channels}=harness(),a=state('highly-secret-bearer');
  const first=create(a);
  const emitted=[];
  for(const channel of channels) {const original=channel.postMessage.bind(channel);channel.postMessage=data=>{emitted.push(data);original(data);};}
  first.announceLogout(a.token);
  assert.ok(emitted.some(e=>e.type==='session-ended'));
  assert.ok(!JSON.stringify(emitted).includes(a.token));
  assert.equal(sessionFingerprint(''), '');
  first.close();
});
