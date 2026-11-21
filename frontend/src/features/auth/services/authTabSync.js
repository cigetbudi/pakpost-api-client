/**
 * Advisory same-origin notifications only. Credentials are never broadcast.
 * Each recipient must independently validate its own HttpOnly cookie against
 * the backend. A forged message cannot grant an authenticated session.
 */
export const AUTH_TAB_CHANNEL = 'pakpost:auth-events:v2';

export function createAuthTabSync({onSessionChanged,
  Channel=typeof BroadcastChannel==='undefined'?null:BroadcastChannel}={}) {
  const noop={announceSession(){},announceLogout(){},close(){}};
  if(!Channel)return noop;
  let channel;
  try { channel=new Channel(AUTH_TAB_CHANNEL); } catch {return noop;}
  const notify=()=>{Promise.resolve().then(()=>onSessionChanged?.()).catch(()=>{});};
  channel.onmessage=event=>{
    if(event?.data?.type==='session-changed')notify();
  };
  return {
    announceSession(){channel.postMessage({type:'session-changed'});},
    announceLogout(){channel.postMessage({type:'session-changed'});},
    close(){channel.onmessage=null;channel.close();},
  };
}
