import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';

/** In-memory tab pointers, revision conflicts and request rename interactions. */
export function useRequestTabSession({ requestWorkbenchStore, cached, page }) {
  const openTabs = useStore(requestWorkbenchStore, s => s.openTabs);
  const setOpenTabs = useStore(requestWorkbenchStore, s => s.setOpenTabs);
  const openTabsRef=useRef(openTabs);openTabsRef.current=openTabs;
  const [remoteAlerts,setRemoteAlerts]=useState({});
  const [conflictDialog,setConflictDialog]=useState(null);
  const [versionDialog,setVersionDialog]=useState(null);
  const [realtimeStatus,setRealtimeStatus]=useState('offline');
  const realtimeHandlerRef=useRef(null);
  const realtimeQueueRef=useRef([]);
  const realtimeTimerRef=useRef(null);
  const [tabMenu, setTabMenu] = useState(null);
  const [editingRequestName, setEditingRequestName] = useState(false);
  const requestNameInputRef = useRef(null);
  const originalRequestNameRef = useRef('');
  const cancelledRequestNameRef = useRef(false);
  const [closeConfirmation, setCloseConfirmation] = useState(null);
  const activeTabId = useStore(requestWorkbenchStore, s => s.activeTabId);
  const setActiveTabId = useStore(requestWorkbenchStore, s => s.setActiveTabId);
  const activeTabRef = useRef(cached?.activeTabId || 't1');
  const tabSequence = useRef(Math.max(1,...(cached?.openTabs || []).map(t=>Number(String(t.id).replace(/^t/,'')) || 0)));
  const draftsRef = useRef(cached?.drafts || {});
  useEffect(() => {
    if (!editingRequestName || page !== 'tester') return;
    const input=requestNameInputRef.current;
    if (input) { input.focus(); input.select(); }
  }, [editingRequestName, activeTabId, page]);
  return {
    openTabs, setOpenTabs, openTabsRef, remoteAlerts, setRemoteAlerts,
    conflictDialog, setConflictDialog, versionDialog, setVersionDialog,
    realtimeStatus, setRealtimeStatus, realtimeHandlerRef, realtimeQueueRef,
    realtimeTimerRef, tabMenu, setTabMenu, editingRequestName, setEditingRequestName,
    requestNameInputRef, originalRequestNameRef, cancelledRequestNameRef,
    closeConfirmation, setCloseConfirmation, activeTabId, setActiveTabId,
    activeTabRef, tabSequence, draftsRef,
  };
}
