import { useEffect, useRef } from 'react';

/**
 * Keep SignalR connection lifecycle outside App. No hub for guests or Local
 * storage; callback ref prevents reconnection on unrelated React renders.
 */
export function useWorkspaceRealtimeLifecycle({ enabled, token, workspaceId, onEvent,
  onAccessChanged, onStatus, onReset }) {
  const callbacks = useRef({onEvent,onAccessChanged,onStatus,onReset});
  callbacks.current = {onEvent,onAccessChanged,onStatus,onReset};
  useEffect(() => {
    callbacks.current.onReset?.();
    if (!enabled || !token || !workspaceId) {
      callbacks.current.onStatus?.('offline');
      return;
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
  }, [enabled, token, workspaceId]);
}
