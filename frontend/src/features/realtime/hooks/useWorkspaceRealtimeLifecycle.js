import { useEffect, useRef } from 'react';
import {getDesktopContext} from '../../../services/httpClient.js';

/**
 * Keep SignalR connection lifecycle outside App. No hub for guests or Local
 * storage; callback ref prevents reconnection on unrelated React renders.
 */
export function useWorkspaceRealtimeLifecycle({ enabled, token, workspaceId, sessionRevision=0, onEvent,
  onAccessChanged, onStatus, onReset, onDesktopPoll, onMemberJoined }) {
  const callbacks = useRef({onEvent,onAccessChanged,onStatus,onReset,onDesktopPoll,onMemberJoined});
  callbacks.current = {onEvent,onAccessChanged,onStatus,onReset,onDesktopPoll,onMemberJoined};
  useEffect(() => {
    callbacks.current.onReset?.();
    if (!enabled || !token || !workspaceId) {
      callbacks.current.onStatus?.('offline');
      return;
    }
    if (window.__TAURI_INTERNALS__) {
      // Event-driven native SignalR WebSocket / Long Polling. REST reconciliation remains a
      // bounded fallback for old servers and a periodic repair for missed events.
      let cancelled=false, timer=null, running=false, failures=0, live=false;
      let stopHub=null, reconnectTimer=null, joining=false;
      const context=getDesktopContext();
      const active=()=>!cancelled && context===getDesktopContext();
      const checkpoint={collections:null,knownCollectionIds:null,indexes:new Map(),pagedCounts:new Map(),cursor:0};
      const schedule=delay=>{clearTimeout(timer);if(active())timer=setTimeout(tick,delay);};
      const tick=async()=>{
        if(!active()||running)return;
        running=true;
        try{
          await callbacks.current.onDesktopPoll?.(checkpoint,active);
          failures=0;
          if(active()&&!live)callbacks.current.onStatus?.('syncing');
        }catch(error){
          if(active()){
            failures++;
            if(!live)callbacks.current.onStatus?.('offline');
            if(error?.status===401)window.dispatchEvent(new Event('pakpost:desktop-session-expired'));
          }
        }finally{
          running=false;
          if(active())schedule(live?60000:Math.min(60000,5000*2**Math.min(failures,4)));
        }
      };
      const retryHub=()=>{if(active()&&!reconnectTimer)reconnectTimer=setTimeout(()=>{reconnectTimer=null;startHub();},30000);};
      async function startHub(){
        if(!active()||!context||joining)return;
        joining=true;
        stopHub?.();stopHub=null;
        try{
          const {connectDesktopSignalR}=await import('../services/desktopSignalR.js');
          if(!active())return;
          const cleanup=await connectDesktopSignalR({workspaceId,context,
            onEvent:event=>{if(active())callbacks.current.onEvent?.(event);},
            onMemberJoined:event=>{if(active())callbacks.current.onMemberJoined?.(event);},
            onAccessChanged:()=>{if(active())callbacks.current.onAccessChanged?.(workspaceId,token);},
            onUnauthorized:()=>{if(active())window.dispatchEvent(new Event('pakpost:desktop-session-expired'));},
            onJoined:()=>{if(active()){live=true;schedule(100);}},
            onStatus:status=>{if(!active())return;live=status==='live';callbacks.current.onStatus?.(status);
              if(!live)schedule(100);
              if(status==='offline')retryHub();},
          });
          if(active())stopHub=cleanup;else cleanup();
        }catch{if(active()){live=false;schedule(100);retryHub();}}
        finally{joining=false;}
      }
      callbacks.current.onStatus?.('connecting');
      tick();startHub();
      const wake=()=>{if(active()&&document.visibilityState==='visible'){if(!running)schedule(100);if(!live&&!stopHub)startHub();}};
      document.addEventListener('visibilitychange',wake);
      window.addEventListener('focus',wake);window.addEventListener('online',wake);
      return ()=>{cancelled=true;clearTimeout(timer);clearTimeout(reconnectTimer);stopHub?.();document.removeEventListener('visibilitychange',wake);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);callbacks.current.onReset?.();};
    }

    let disposed = false, stop = null;
    import('../services/workspaceRealtime.js').then(({connectWorkspaceRealtime}) =>
      connectWorkspaceRealtime({workspaceId, getToken: () => token,
        onEvent: event => { if (!disposed) callbacks.current.onEvent?.(event); },
        onMemberJoined: event => { if (!disposed) callbacks.current.onMemberJoined?.(event); },
        onAccessChanged: () => { if (!disposed) callbacks.current.onAccessChanged?.(workspaceId, token); },
        onStatus: status => { if (!disposed) callbacks.current.onStatus?.(status); },
      })
    ).then(cleanup => { if (disposed) cleanup?.(); else stop = cleanup; })
      .catch(() => { if (!disposed) callbacks.current.onStatus?.('offline'); });
    return () => { disposed = true; stop?.(); callbacks.current.onReset?.(); };
  }, [enabled, token, workspaceId, sessionRevision]);
}
