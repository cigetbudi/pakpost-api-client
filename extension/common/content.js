/* Isolated-world bridge. The background script validates sender + destination afresh. */
(()=>{
  if(window.top!==window||window.__pakpostContentBridgeInstalled)return;
  const CHANNEL='pakpost.interceptor.v1';
  // The content script is injected only at manually authorized web origins.
  Object.defineProperty(window,'__pakpostContentBridgeInstalled',{value:true,configurable:false});
  // Popup-only discovery request. Return host candidates (no path/body/credential data).
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.kind!=='PAKPOST_DISCOVER_HOSTS'||sender.id!==chrome.runtime.id)return false;
    const id=`discover-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer=setTimeout(()=>{
      window.removeEventListener('message',onResponse);
      respond({ok:false,error:'Pakpost did not respond. Reload the tab and try again.'});
    },3000);
    function onResponse(event){
      if(event.source!==window||event.origin!==location.origin)return;
      const data=event.data;
      if(data?.channel!==CHANNEL||data?.type!=='DISCOVER_HOSTS_RESPONSE'||data.id!==id)return;
      clearTimeout(timer);window.removeEventListener('message',onResponse);
      respond({ok:true,origins:Array.isArray(data.origins)?data.origins.slice(0,96):[]});
    }
    window.addEventListener('message',onResponse);
    window.postMessage({channel:CHANNEL,type:'DISCOVER_HOSTS_REQUEST',id},location.origin);
    return true;
  });
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin)return;
    const data=event.data;
    if(data?.channel!==CHANNEL||data?.type!=='REQUEST'||!['PING','SEND'].includes(data.action)||typeof data.id!=='string'||data.id.length>100)return;
    chrome.runtime.sendMessage({kind:'PAKPOST_BRIDGE',channel:CHANNEL,action:data.action,payload:data.payload},response=>{
      const error=chrome.runtime.lastError;
      const safe=error?{ok:false,error:error.message}:response||{ok:false,error:'Extension is unavailable'};
      window.postMessage({channel:CHANNEL,type:'RESPONSE',id:data.id,...safe},location.origin);
    });
  });
})();
