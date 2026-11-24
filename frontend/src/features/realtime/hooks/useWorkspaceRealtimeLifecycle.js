import { useEffect, useRef } from 'react';

/**
 * Keep SignalR connection lifecycle outside App. No hub for guests or Local
 * storage; callback ref prevents reconnection on unrelated React renders.
 */
export function useWorkspaceRealtimeLifecycle({ enabled, token, workspaceId, sessionRevision=0, onEvent,
  onAccessChanged, onStatus, onReset, onDesktopPoll }) {
  const callbacks = useRef({onEvent,onAccessChanged,onStatus,onReset,onDesktopPoll});
  callbacks.current = {onEvent,onAccessChanged,onStatus,onReset,onDesktopPoll};
  useEffect(() => {
    callbacks.current.onReset?.();
    if (!enabled || !token || !workspaceId) {
      callbacks.current.onStatus?.('offline');
      return;
    }
    if (window.__TAURI_INTERNALS__) {
      // Desktop tokens must remain in Rust. REST convergence is a safe fallback
      // until native, authenticated SignalR transport is available.
      let cancelled=false, timer=null, running=false, failures=0;
      const checkpoint={collections:null,knownCollectionIds:null,indexes:new Map(),pagedCounts:new Map(),cursor:0};
      const tick=async()=>{
        if(cancelled||running)return;
        running=true;
        try {
          await callbacks.current.onDesktopPoll?.(checkpoint,()=>!cancelled);
          failures=0;
          if(!cancelled)callbacks.current.onStatus?.('syncing');
        } catch(error) {
          if(!cancelled) {
            failures++;
            callbacks.current.onStatus?.('offline');
            // A revoked session must not keep a stale workspace visually live.
            if(error?.status===401)window.dispatchEvent(new Event('pakpost:desktop-session-expired'));
          }
        } finally {
          running=false;
          if(!cancelled)timer=setTimeout(tick,Math.min(60000,5000*2**Math.min(failures,4)));
        }
      };
      callbacks.current.onStatus?.('connecting');
      tick();
      const wake=()=>{if(document.visibilityState==='visible'&&!running){clearTimeout(timer);timer=setTimeout(tick,100);}};
      document.addEventListener('visibilitychange',wake);
      window.addEventListener('focus',wake);
      window.addEventListener('online',wake);
      return ()=>{cancelled=true;clearTimeout(timer);document.removeEventListener('visibilitychange',wake);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);callbacks.current.onReset?.();};
    }
    let disposed = false, stop = null;
    import('../services/workspaceRealtime.js').then(({connectWorkspaceRealtime}) =>
      connectWorkspaceRealtime({workspaceId, getToken: () => token,
        onEvent: event => { if (!disposed) callbacks.current.onEvent?.(event); },
        onAccessChanged: () => { if (!disposed) callbacks.current.onAccessChanged?.(workspaceId, token); },
        onStatus: status => { if (!disposed) callbacks.current.onStatus?.(status); },
      })
    ).then(cleanup => { if (disposed) cleanup?.(); else stop = cleanup; })
      .catch(() => { if (!disposed) callbacks.current.onStatus?.('offline'); });
    return () => { disposed = true; stop?.(); callbacks.current.onReset?.(); };
  }, [enabled, token, workspaceId, sessionRevision]);
}
