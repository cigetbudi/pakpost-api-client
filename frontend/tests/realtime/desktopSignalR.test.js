import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeHubHttpClient} from '../../src/features/realtime/services/desktopSignalR.js';
class HttpClient {}
class HttpResponse {constructor(statusCode,statusText,content){Object.assign(this,{statusCode,statusText,content});}}
class HttpError extends Error {constructor(message,statusCode){super(message);this.statusCode=statusCode;}}
class AbortError extends Error {}
const signalR={HttpClient,HttpResponse,HttpError,AbortError};
const context={profileId:'public',origin:'https://example.test',generation:1};
const request={url:'https://example.test/hubs/workspace/negotiate?negotiateVersion=1',method:'POST',content:''};
test('native hub only passes lease metadata and text frames',async()=>{
  const client=createNativeHubHttpClient(signalR,async(name,args)=>{
    assert.equal(name,'remote_hub_http');assert.deepEqual(args,{context,url:request.url,method:'POST',content:''});
    return {status:200,content:'{"connectionId":"test"}'};
  },context);
  const result=await client.send(request);assert.equal(result.statusCode,200);assert.match(result.content,/connectionId/);
  assert.equal(client.getCookieString(),'');
});
test('reject cross-origin and arbitrary routes before invoking native bridge',async()=>{
  const client=createNativeHubHttpClient(signalR,()=>assert.fail('must not invoke'),context);
  for(const url of ['https://other.test/hubs/workspace','https://example.test/api/auth/me'])await assert.rejects(client.send({...request,url}),/Invalid hub destination/);
});
test('401 triggers revalidation; forbidden does not clear login',async()=>{
  let n=0,status=403;
  const client=createNativeHubHttpClient(signalR,async()=>({status,content:''}),context,()=>n++);
  await assert.rejects(client.send(request),e=>e.statusCode===403);assert.equal(n,0);
  status=401;await assert.rejects(client.send(request),e=>e.statusCode===401);assert.equal(n,1);
});
test('cancelled poll ignores delayed result',async()=>{
  let finish;let n=0;
  const client=createNativeHubHttpClient(signalR,()=>new Promise(r=>{finish=r}),context,()=>n++);
  const abortSignal={aborted:false,onabort:null};const pending=client.send({...request,abortSignal});
  abortSignal.aborted=true;abortSignal.onabort();await assert.rejects(pending,AbortError);
  finish({status:401,content:''});await Promise.resolve();assert.equal(n,0);
});

const {createNativeHubWebSocket}=await import('../../src/features/realtime/services/desktopSignalR.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const wsUrl='wss://example.test/hubs/workspace?id=connection';
function socketFixture(invoke=async()=>{}){
  const channel={},calls=[];let unauthorized=0;
  const Socket=createNativeHubWebSocket(async(name,args)=>{calls.push([name,args]);return invoke(name,args);},()=>channel,context,()=>unauthorized++,()=> 'socket-1');
  return {Socket,channel,calls,unauthorized:()=>unauthorized};
}
test('native websocket rejects arbitrary endpoints and query credentials',()=>{
  const {Socket,calls}=socketFixture();
  for(const url of ['ws://example.test/hubs/workspace?id=x','wss://other.test/hubs/workspace?id=x','wss://example.test/api/auth?id=x','wss://example.test/hubs/workspace?id=x&access_token=secret','wss://example.test/hubs/workspace?id=x&id=y','wss://user@example.test/hubs/workspace?id=x'])assert.throws(()=>new Socket(url),/Invalid hub socket destination/);
  assert.equal(calls.length,0);
});
test('native websocket connects via channel, preserves send order, and closes',async()=>{
  const {Socket,channel,calls}=socketFixture();const socket=new Socket(wsUrl);const received=[];
  socket.onmessage=e=>received.push(e.data);await flush();
  assert.equal(calls[0][0],'open_hub_socket');assert.equal(calls[0][1].context,context);
  channel.onmessage({type:'open'});assert.equal(socket.readyState,Socket.OPEN);
  socket.send('one');socket.send('two');await flush();
  assert.deepEqual(calls.slice(1).map(([,a])=>a.content),['one','two']);
  channel.onmessage({type:'message',data:'frame'});assert.deepEqual(received,['frame']);
  socket.close();await flush();assert.equal(calls.at(-1)[0],'close_hub_socket');assert.equal(socket.readyState,Socket.CLOSED);
  channel.onmessage({type:'message',data:'late'});assert.deepEqual(received,['frame']);
});
test('closing during registration still cancels the Rust socket',async()=>{
  let release;const {Socket,channel,calls}=socketFixture(name=>name==='open_hub_socket'?new Promise(r=>release=r):undefined);
  const socket=new Socket(wsUrl);await flush();socket.close();channel.onmessage({type:'open'});release();await flush();
  assert.equal(socket.readyState,Socket.CLOSED);assert.equal(calls.at(-1)[0],'close_hub_socket');
});
test('failed socket signals close for SignalR transport fallback',async()=>{
  const {Socket}=socketFixture(async()=>{throw Error('unavailable');});const socket=new Socket(wsUrl);let code;
  socket.onclose=e=>code=e.code;await flush();assert.equal(code,1006);assert.equal(socket.readyState,Socket.CLOSED);
});
test('unauthorized socket notifies once and discards late frames',async()=>{
  const {Socket,channel,unauthorized}=socketFixture();const socket=new Socket(wsUrl);await flush();channel.onmessage({type:'unauthorized'});channel.onmessage({type:'unauthorized'});
  assert.equal(unauthorized(),1);assert.equal(socket.readyState,Socket.CLOSED);
});
