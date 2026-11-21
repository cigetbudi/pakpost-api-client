import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthTabSync,AUTH_TAB_CHANNEL} from '../../src/features/auth/services/authTabSync.js';

function makeChannels(){
  const channels=new Set(),messages=[];
  class FakeChannel {
    constructor(name){this.name=name;this.onmessage=null;channels.add(this);}
    postMessage(data){messages.push(data);for(const peer of channels)
      if(peer!==this&&peer.name===this.name)peer.onmessage?.({data});}
    close(){channels.delete(this);}
  }
  return {FakeChannel,messages};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('login only announces a session change, never a bearer',async()=>{
  const {FakeChannel,messages}=makeChannels();let checks=0;
  const first=createAuthTabSync({Channel:FakeChannel});
  const second=createAuthTabSync({Channel:FakeChannel,onSessionChanged:()=>checks++});
  first.announceSession();await flush();
  assert.equal(checks,1);
  assert.deepEqual(messages,[{type:'session-changed'}]);
  assert.equal(AUTH_TAB_CHANNEL,'pakpost:auth-events:v2');
  first.close();second.close();
});

test('logout notifies peers; recipient independently validates cookie',async()=>{
  const {FakeChannel,messages}=makeChannels();let checks=0;
  const first=createAuthTabSync({Channel:FakeChannel});
  const second=createAuthTabSync({Channel:FakeChannel,onSessionChanged:()=>checks++});
  first.announceLogout();await flush();
  assert.equal(checks,1);
  assert.equal(JSON.stringify(messages).includes('token'),false);
  first.close();second.close();
});

test('no BroadcastChannel falls back safely',()=>{
  const channel=createAuthTabSync({Channel:null});
  assert.doesNotThrow(()=>{channel.announceSession();channel.announceLogout();channel.close();});
});
