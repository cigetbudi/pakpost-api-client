// Runner workbench actions. Stateless factory: shared logic remains scoped to the mounted App.
// Dependencies are passed from the current render; no singleton store or persist middleware.
export function createCollectionRunnerActions(dependencies) {
  const {
    STORAGE_WORKSPACE,
    activeEnvironment,
    activeTabRef,
    api,
    collectionVariableKey,
    collections,
    collectionsScope,
    getMessage,
    interceptorMode,
    localCollections,
    me,
    openTabs,
    readCollectionVariables,
    readSavedCollectionVariables,
    runnerFetchId,
    runnerTarget,
    savedCollectionVariableMap,
    selectedCol,
    selectedWs,
    sessionCollectionVariables,
    setNotice,
    setRunnerLoading,
    setRunnerTarget,
    token,
    varsFromEnv,
    workspaceDraft
  } = dependencies;

  async function openCollectionRunner(target){
      if(runnerTarget){setNotice('Close the current Collection Runner before opening another.');return;}
      const fetchId=++runnerFetchId.current;
      setRunnerLoading(true);
      try{
        const source={...target};
        let items=[];
        if(source.scope==='local'){
          const collection=localCollections.find(c=>c.id===source.collectionId);
          if(!collection)throw Error('Local collection not found');
          items=(collection.requests||[]).map(r=>({...r,name:r.requestName||r.name}));
        }else{
          if(!token||!source.workspaceId)throw Error('Sign in and choose a Workspace first');
          items=(await api(`/api/workspaces/${source.workspaceId}/collections/${source.collectionId}/requests`,'GET',undefined,token))
            .map(item=>workspaceDraft(item));
        }
        const saved=await readSavedCollectionVariables(source,{reload:true});
        const key=collectionVariableKey(source,'',me?.id||'guest');
        const collectionVars=readCollectionVariables(sessionCollectionVariables.current,key,savedCollectionVariableMap(saved.variables));
        // Snapshot is intentionally private to this single run. Runner scripts never
        // call applyScriptVariables or write Collection/Environment Cloud defaults.
        if(fetchId!==runnerFetchId.current)return;
        setRunnerTarget({...source,requests:items,environmentVariables:{...varsFromEnv()},
          collectionVariables:collectionVars,preScript:saved.preScript||'',postScript:saved.postScript||'',transport:interceptorMode,environmentName:activeEnvironment?.name||'No environment'});
      }catch(error){if(fetchId===runnerFetchId.current)setNotice(`Collection Runner: ${getMessage(error)}`);}
      finally{if(fetchId===runnerFetchId.current)setRunnerLoading(false);}
    }

  function openRunnerForCurrentCollection(){
      if(collectionsScope===STORAGE_WORKSPACE){
        const col=collections.find(c=>c.id===selectedCol);
        if(!col){setNotice('Select a Cloud Collection to run first.');return;}
        openCollectionRunner({scope:'workspace',workspaceId:selectedWs,collectionId:col.id,name:col.name});
      }else{
        const source=openTabs.find(t=>t.id===activeTabRef.current)?.source;
        const col=localCollections.find(c=>c.id===source?.collectionId)||localCollections[0];
        if(!col){setNotice('Create or select a Local Collection first.');return;}
        openCollectionRunner({scope:'local',collectionId:col.id,name:col.name});
      }
    }

  function closeRunner(){runnerFetchId.current++;setRunnerLoading(false);setRunnerTarget(null);}
  return { openCollectionRunner, openRunnerForCurrentCollection, closeRunner };
}
