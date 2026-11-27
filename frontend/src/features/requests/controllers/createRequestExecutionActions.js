// Request workbench actions. Stateless factory: shared logic remains scoped to the mounted App.
// Dependencies are passed from the current render; no singleton store or persist middleware.
export function createRequestExecutionActions(dependencies) {
  const {
    activeEnvironment,
    activeSessionEnvironmentKey,
    activeTabRef,
    api,
    appendConsoleEvent,
    applyScriptVariables,
    binaryFile,
    body,
    buildOutgoing,
    canEditCloud,
    canWriteEnvironment,
    collectionVariableKey,
    currentTokenRef,
    executionRef = {current:null},
    dispatchRequest,
    draftsRef,
    envScope,
    executeWorkbenchRequest,
    formFields,
    format,
    getMessage,
    interceptorMode,
    isReadOnlyCloudTab,
    loading,
    me,
    method,
    openTabsRef,
    postScript,
    preScript,
    readCollectionVariables,
    readSavedCollectionVariables,
    refreshSessionEnvironment = () => {},
    rows,
    savedCollectionVariableMap,
    scriptDiagnostic,
    scriptError,
    selectedWs,
    sessionCollectionVariables,
    setLoading,
    setNotice,
    setOpenTabs,
    setPrettyResponse,
    setRecent,
    setResTab,
    setResponsePretty,
    setResult,
    setScriptDiagnostic,
    setScriptError,
    setScriptJump,
    setScriptLog,
    setScriptTests,
    stashActive,
    url,
    varsFromEnv,
    writeCollectionVariables
  } = dependencies;

  async function sendRequest() {
      if(!url.trim()){setNotice('Enter a request URL first');return;}
      if(loading||executionRef.current)return;
      const controller=new AbortController();
      const canCancel=interceptorMode==='browser'||interceptorMode==='native'||(interceptorMode==='proxy'&&!globalThis.window?.__TAURI_INTERNALS__);
      executionRef.current={controller,canCancel};
      const tabId=activeTabRef.current;
      const executionId=globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const startedAt=performance.now();
      const trace=(level,phase,message,details={})=>appendConsoleEvent({executionId,tabId,level,phase,message,...details});
      const runToken=currentTokenRef.current;
      try {
      trace('info','request','Execution started',{method});
      stashActive();setLoading(true);setResult(null);setPrettyResponse('');setResponsePretty(true);
      setScriptError('');setScriptDiagnostic(null);setScriptJump(null);setScriptLog([]);setScriptTests([]);
      // Freeze the account, workspace, environment and Collection for this Send.
      const environmentValues=varsFromEnv();
      const isCurrent=()=>runToken===currentTokenRef.current&&!controller.signal.aborted;
      const runEnvironment={environment:activeEnvironment,scope:envScope,sessionKey:activeSessionEnvironmentKey,
        canWrite:canWriteEnvironment,initialValues:{...environmentValues}};
      const sourceAtSend=openTabsRef.current.find(t=>t.id===tabId)?.source;
      const collectionKey=collectionVariableKey(sourceAtSend,tabId,me?.id||'guest');
      const collectionValues=readCollectionVariables(sessionCollectionVariables.current,collectionKey);
        const executed=await executeWorkbenchRequest({
          request:{method,url,rows,body,format,formFields,binaryFile,preScript,postScript,interceptorMode},
          environmentValues,collectionValues,trace,
          loadCollectionSettings:sourceAtSend?.collectionId?async()=>{
            if(sourceAtSend.scope==='workspace'&&sourceAtSend.workspaceId!==selectedWs)throw Error('Select the request workspace before sending.');
            const savedData=await readSavedCollectionVariables(sourceAtSend,{reload:true});
            return {values:readCollectionVariables(sessionCollectionVariables.current,collectionKey,savedCollectionVariableMap(savedData.variables)),
              preScript:savedData.preScript||'',postScript:savedData.postScript||''};
          }:null,
          // In-flight responses from a previous account must never restore data
          // or write variables after logout/account switch.
          isCurrent,
          saveCollectionValues:values=>{if(isCurrent()){writeCollectionVariables(sessionCollectionVariables.current,collectionKey,values);refreshSessionEnvironment(v=>v+1);}},
          saveEnvironmentValues:values=>isCurrent()?applyScriptVariables(values,runEnvironment):undefined,
          buildOutgoing:vars=>buildOutgoing(vars),
          dispatch:command=>{
            if(!isCurrent())throw Error('Request cancelled');
            const options={signal:controller.signal};
            return interceptorMode==='proxy'?api('/api/proxy/send','POST',command,'',options):dispatchRequest(command,interceptorMode,options);
          },
        });
        if(runToken!==currentTokenRef.current)return;
        if(controller.signal.aborted)throw Error('Request cancelled');
        const {response:r,command,logs,tests,scriptError,scriptDiagnostic}=executed;
        draftsRef.current[tabId]={...draftsRef.current[tabId],result:r,resTab:'body',scriptLog:logs,scriptTests:tests,scriptError,scriptDiagnostic};
        if(tabId===activeTabRef.current){setResult(r);setResTab('body');setScriptLog(logs);setScriptTests(tests);setScriptError(scriptError);setScriptDiagnostic(scriptDiagnostic);}
        setOpenTabs(t=>t.map(x=>x.id===tabId?{...x,status:r.statusCode}:x));
        if(!isReadOnlyCloudTab(openTabsRef.current.find(t=>t.id===tabId),canEditCloud,selectedWs))
          setRecent(old=>[{method,url:command.url,status:r.statusCode,elapsed:r.elapsedMs,body,rows:rows.map(x=>({...x}))},...old].slice(0,20));
      }catch(e){
        if(runToken!==currentTokenRef.current)return;
        if(controller.signal.aborted){
          trace('info','request','Request cancelled by user');
          const result={cancelled:true,error:'Stopped waiting for the response. The server may already have processed the request.'};
          if(openTabsRef.current.some(t=>t.id===tabId))draftsRef.current[tabId]={...draftsRef.current[tabId],result};
          if(tabId===activeTabRef.current)setResult(result);
          return;
        }
        trace('error','request','Execution failed',{errorCode:e?.name||'Error'});
        const error={error:getMessage(e)};
        const diagnostic=e?.scriptDiagnostic||null;
        const logs=e?.executionLogs||[];
        const tests=e?.executionTests||[];
        draftsRef.current[tabId]={...draftsRef.current[tabId],result:error,scriptLog:logs,scriptTests:tests,scriptError:getMessage(e),scriptDiagnostic:diagnostic};
        if(tabId===activeTabRef.current){setResult(error);setScriptLog(logs);setScriptTests(tests);setScriptError(getMessage(e));setScriptDiagnostic(diagnostic);}
      }finally{if(executionRef.current?.controller===controller)executionRef.current=null;trace('info','request','Execution finished',{elapsedMs:Math.round(performance.now()-startedAt)});setLoading(false)}
    }
  function cancelRequest(){const run=executionRef.current;if(run?.canCancel)run.controller.abort();}
  return { sendRequest,cancelRequest };
}
