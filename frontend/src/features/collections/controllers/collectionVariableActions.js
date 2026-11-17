// Stateful operations remain owned by the mounted Workbench; dependencies are injected.
// This factory is intentionally not a hook: no subscriptions or globals are created.
export function createCollectionVariableActions(dependencies) {
  const {
    api, canWorkspace, collectionVariableKey, collectionVariablesData, collectionVariablesFetchId, collectionVariablesTarget, getMessage,
    localCollections, me, refreshSessionEnvironment, resetCollectionVariables, rows, savedCollectionVariablesCache, selfMember,
    sessionCollectionVariables, setCollectionVariablesBusy, setCollectionVariablesData, setCollectionVariablesError, setCollectionVariablesLoading, setCollectionVariablesTarget, setLocalCollections,
    token, validateCollectionVariableRows, writeCollectionVariables,
  } = dependencies;
  function collectionTargetKey(target){
    return collectionVariableKey(target,'',me?.id||'guest');
  }
  async function readSavedCollectionVariables(target,{reload=false}={}){
    if(target.scope==='local')return {version:0,variables:localCollections.find(c=>c.id===target.collectionId)?.variables||[]};
    const key=collectionTargetKey(target);
    const cached=savedCollectionVariablesCache.current.get(key);
    if(!reload&&cached&&Date.now()-cached.at<30000)return cached.data;
    const data=await api(`/api/workspaces/${target.workspaceId}/collections/${target.collectionId}/variables`,'GET',undefined,token);
    savedCollectionVariablesCache.current.delete(key);
    savedCollectionVariablesCache.current.set(key,{data,at:Date.now()});
    // LRU-style cap keeps this optional feature from accumulating unbounded data.
    if(savedCollectionVariablesCache.current.size>50)savedCollectionVariablesCache.current.delete(savedCollectionVariablesCache.current.keys().next().value);
    return data;
  }
  async function openCollectionVariables(target){
    const selected={...target};
    const id=++collectionVariablesFetchId.current;
    setCollectionVariablesTarget(selected);setCollectionVariablesData(null);
    setCollectionVariablesError('');setCollectionVariablesLoading(true);
    try{
      const data=await readSavedCollectionVariables(selected,{reload:selected.scope==='workspace'});
      if(id===collectionVariablesFetchId.current)setCollectionVariablesData(data);
    }catch(error){if(id===collectionVariablesFetchId.current)setCollectionVariablesError(getMessage(error));}
    finally{if(id===collectionVariablesFetchId.current)setCollectionVariablesLoading(false);}
  }
  async function reloadCollectionVariables(){
    if(!collectionVariablesTarget)return;
    const data=await readSavedCollectionVariables(collectionVariablesTarget,{reload:true});
    setCollectionVariablesData(data);setCollectionVariablesError('');
  }
  async function saveCollectionVariableDefaults(rows){
    const target=collectionVariablesTarget;
    if(!target)throw Error('No collection selected');
    const normalized=validateCollectionVariableRows(rows);
    setCollectionVariablesBusy(true);
    try{
      if(target.scope==='local'){
        setLocalCollections(old=>old.map(c=>c.id===target.collectionId?{...c,variables:normalized.map(({key,value,isSecret})=>({key,value,isSecret}))}:c));
        setCollectionVariablesData({version:0,variables:normalized});
      }else{
        if(!canWorkspace(selfMember,'collection.write'))throw Error('Missing permission: collection.write');
        if(!collectionVariablesData)throw Error('Reload Collection Variables before saving');
        const saved=await api(`/api/workspaces/${target.workspaceId}/collections/${target.collectionId}/variables`,'PUT',
          {version:collectionVariablesData.version,variables:normalized},token);
        savedCollectionVariablesCache.current.set(collectionTargetKey(target),{data:saved,at:Date.now()});
        setCollectionVariablesData(saved);
      }
    }finally{setCollectionVariablesBusy(false);}
  }
  function applyCollectionVariableSession(next){
    if(!collectionVariablesTarget)return;
    writeCollectionVariables(sessionCollectionVariables.current,collectionTargetKey(collectionVariablesTarget),next);
    refreshSessionEnvironment(v=>v+1);
  }
  function resetCollectionVariableSession(){
    if(!collectionVariablesTarget)return;
    resetCollectionVariables(sessionCollectionVariables.current,collectionTargetKey(collectionVariablesTarget));
    refreshSessionEnvironment(v=>v+1);
  }
  return { collectionTargetKey, readSavedCollectionVariables, openCollectionVariables, reloadCollectionVariables, saveCollectionVariableDefaults, applyCollectionVariableSession, resetCollectionVariableSession };
}
