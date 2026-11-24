// Tab navigation, new drafts and Console link navigation.
export function createRequestTabNavigationActions(dependencies) {
  const {
    EMPTY_HEADER, activeTabRef, binaryFile, cancelledRequestNameRef, draftsRef,
    formFields, freshRequest, method, openBoundRequest, openTabs,
    originalRequestNameRef, params, requestFingerprint, result, rows,
    scriptError, scriptLog, scriptTests, selectedCol, selectedWs,
    setActiveTabId, setConsoleOpen, setEditingRequestName, setNotice, setOpenTabs,
    setPage, setReqTab, setScriptJump, tabSequence, workspaceDraft,
    stashActive, restoreDraft,
  } = dependencies;

  function selectTab(id) {
      setOpenTabs(tabs=>tabs.map(t=>t.id===id?{...t,lastOpenedAt:Date.now()}:t));
      setEditingRequestName(false);
      if (id === activeTabRef.current) { setPage('tester'); return; }
      stashActive();
      const next = draftsRef.current[id];
      if (!next) return;
      activeTabRef.current = id; setActiveTabId(id);
      restoreDraft(next);

      setPage('tester');
    }
  function navigateConsoleEvent(event) {
      if (!event?.line || !['pre-script','post-script'].includes(event.phase)) return;
      if (!openTabs.some(tab => tab.id === event.tabId)) {
        setNotice('The request tab for this Console event is no longer open.');
        return;
      }
      selectTab(event.tabId);
      setReqTab(event.phase==='post-script'?'post-script':'pre-script');
      setScriptJump({phase:event.phase==='pre-script'?'pre':'post',line:event.line,column:event.column||1,serial:Date.now()});
      setConsoleOpen(false);
    }
  function addTab(request, source = null, { focusName = false } = {}) {
      stashActive();
      const id = `t${++tabSequence.current}`;
      const draft = { ...freshRequest(request?.name || 'Untitled Request'), ...request, binaryFile:{name:request?.binaryFile?.name||'',base64:''},
        params:request?.params||[{...EMPTY_HEADER}],rows:request?.rows||[{...EMPTY_HEADER}],
        formFields:request?.formFields||[{...EMPTY_HEADER}],result:null,scriptLog:[],scriptTests:[],scriptError:''};
      draftsRef.current[id] = draft; activeTabRef.current = id;
      const name = request?.name || 'Untitled Request';
      setOpenTabs(t => [...t, { id, name, savedName:name, lastOpenedAt:Date.now(), method: draft.method, source, savedFingerprint:requestFingerprint(draft,name) }]);
      originalRequestNameRef.current=name; cancelledRequestNameRef.current=false; setEditingRequestName(focusName);
      setActiveTabId(id); restoreDraft(draft); setPage('tester');
    }
  function selectTabFromDraft(id) {
      setEditingRequestName(false);
      const next = draftsRef.current[id];
      if (!next) return;
      activeTabRef.current = id; setActiveTabId(id);
      restoreDraft(next);

      setPage('tester');
    }
  function loadSavedRequest(item) {
      openBoundRequest(workspaceDraft(item),
        {scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId||selectedCol,requestId:item.id,revision:item.revision});
    }

  return { selectTab, navigateConsoleEvent, addTab, selectTabFromDraft, loadSavedRequest };
}
