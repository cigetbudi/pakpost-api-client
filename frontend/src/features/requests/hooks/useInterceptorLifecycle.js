import { useEffect } from 'react';
import { EXTENSION_CHANNEL, probeExtension, writeInterceptorMode } from '../services/interceptorClient.js';
import { discoverApiDestinations } from '../services/interceptorDiscovery.js';

/** Extension status and user-initiated host discovery. Never disclose URL
 * paths, header values, auth state or environment secrets to the extension. */
export function useInterceptorLifecycle({
  draftsRef, interceptorMode, localCollections, localEnvironments, openTabs,
  setExtensionStatus, url, workspaceEnvironments, workspaceRequestLists,
}) {
  useEffect(()=>{writeInterceptorMode(localStorage,interceptorMode)},[interceptorMode]);
  async function refreshExtensionStatus(){
    setExtensionStatus({state:'checking',version:''});
    try{const info=await probeExtension();setExtensionStatus({state:'connected',version:String(info?.version||'')});}
    catch{setExtensionStatus({state:'disconnected',version:''});}
  }
  useEffect(()=>{if(interceptorMode==='extension')refreshExtensionStatus();},[interceptorMode]);

  // User-invoked extension discovery: only scheme/host/port are exposed (no paths,
  // headers, tokens, or environment contents). The extension still prompts for permission.
  useEffect(()=>{
    const onDiscover=event=>{
      if(event.source!==window||event.origin!==window.location.origin)return;
      const data=event.data;
      if(data?.channel!==EXTENSION_CHANNEL||data?.type!=='DISCOVER_HOSTS_REQUEST'||typeof data.id!=='string'||data.id.length>100)return;
      const origins=discoverApiDestinations({
        url,openTabs,drafts:draftsRef.current,localCollections,workspaceRequestLists,
        localEnvironments,workspaceEnvironments
      });
      window.postMessage({channel:EXTENSION_CHANNEL,type:'DISCOVER_HOSTS_RESPONSE',id:data.id,origins},window.location.origin);
    };
    window.addEventListener('message',onDiscover);
    return ()=>window.removeEventListener('message',onDiscover);
  },[url,openTabs,localCollections,workspaceRequestLists,localEnvironments,workspaceEnvironments]);
  return { refreshExtensionStatus };
}
