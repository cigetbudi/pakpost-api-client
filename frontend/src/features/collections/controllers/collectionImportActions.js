// Stateful operations remain owned by the mounted Workbench; dependencies are injected.
// This factory is intentionally not a hook: no subscriptions or globals are created.
export function createCollectionImportActions(dependencies) {
  const {
    STORAGE_LOCAL, STORAGE_WORKSPACE, activeTabRef, allowedStorageScope, api, blankDraft, collectionImportSources,
    collections, draftsRef, getMessage, localCollections, localEnvironments, me, restoreDraft,
    saveCloudCollections, selectEnvironmentForContext, selectedWs, setActiveTabId, setCollections, setExpandedCollections, setExplorerTab,
    setLocalCollections, setLocalEnvironments, setOpenTabs, setPage, setSelectedCol, setSidebarCollapsed, setStorageScope,
    setWorkspaceEnvironments, stashActive, tabSequence, toLocalCollection, token, uniqueEnvironmentImports, validateLibrary,
    workspaceCollectionKey, workspaceFetchEpoch,
  } = dependencies;
  async function importPreparedEnvironments(imported,destination){
    if(!imported.length)return 0;
    const cloud=destination===STORAGE_WORKSPACE;
    const workspaceId=selectedWs,auth=token,epoch=workspaceFetchEpoch.current;
    if(cloud&&(!auth||!workspaceId))throw Error('Sign in and select a workspace before importing environments to Cloud.');
    // Remote list may not be loaded yet when the user is browsing Local environments.
    // Always read the destination workspace's real list: never dedupe against another team's cached list.
    const existing=cloud?await api(`/api/workspaces/${workspaceId}/environments`,'GET',undefined,auth):localEnvironments;
    const prepared=uniqueEnvironmentImports(imported,existing);
    if(!cloud){
      const added=prepared.map(env=>({...env,id:crypto.randomUUID(),variables:(env.variables||[]).map(v=>({key:String(v.key||''),value:String(v.value||''),isSecret:!!v.isSecret}))}));
      setLocalEnvironments(old=>[...old,...added]);
      setStorageScope(STORAGE_LOCAL);selectEnvironmentForContext(STORAGE_LOCAL,'','',added[0].id);
      return added.length;
    }
    const base=`/api/workspaces/${workspaceId}/environments`;
    const saved=[];
    for(const env of prepared){
      let created;
      try{
        created=await api(base,'POST',{name:env.name},auth);
        saved.push(await api(`${base}/${created.id}`,'PUT',{name:env.name,variables:env.variables},auth));
      }catch(error){
        // Undo only the empty record created by this failed environment; keep earlier successful imports.
        if(created){try{await api(`${base}/${created.id}`,'DELETE',undefined,auth)}catch{}}
        if(saved.length&&epoch===workspaceFetchEpoch.current)setWorkspaceEnvironments(old=>[...old.filter(e=>!saved.some(x=>x.id===e.id)),...saved]);
        throw Error(`Cloud import partially completed (${saved.length}/${prepared.length} environments): ${getMessage(error)}`);
      }
    }
    if(epoch===workspaceFetchEpoch.current){
      setWorkspaceEnvironments(old=>[...old.filter(e=>!saved.some(x=>x.id===e.id)),...saved]);
      setStorageScope(STORAGE_WORKSPACE);selectEnvironmentForContext(STORAGE_WORKSPACE,workspaceId,me?.id,saved[0].id);
    }
    return saved.length;
  }
  async function importCloudCollections(sources){
    const workspaceId=selectedWs;
    const auth=token;
    const epoch=workspaceFetchEpoch.current;
    let imported;
    try{
      imported=await saveCloudCollections(sources,{workspaceId,token:auth,request:api,onCreated:created=>{
        if(epoch===workspaceFetchEpoch.current)setCollections(old=>[...old,created]);
      }});
    }catch(error){
      // A failed remote import can still have successful records: refresh without local fallback.
      if(auth&&workspaceId){try{
        const latest=await api(`/api/workspaces/${workspaceId}/collections`,'GET',undefined,auth);
        if(epoch===workspaceFetchEpoch.current)setCollections(latest);
      }catch{}}
      throw error;
    }
    try{
      const latest=await api(`/api/workspaces/${workspaceId}/collections`,'GET',undefined,auth);
      if(epoch===workspaceFetchEpoch.current)setCollections(latest);
    }catch{}
    if(epoch===workspaceFetchEpoch.current){
      if(imported.firstId){setSelectedCol(imported.firstId);setExpandedCollections(old=>({...old,[workspaceCollectionKey(workspaceId,imported.firstId)]:true}));}
      setStorageScope(STORAGE_WORKSPACE);
      setExplorerTab('collections');setSidebarCollapsed(false);setPage('tester');
    }
    return imported.count;
  }
  async function importRequestsAndEnvironments({kind,requests=[],environments=[],collections:incoming=[]},requestedDestination){
    if(requests.length>200)throw Error('Import limit: maximum 200 requests.');
    const destination=allowedStorageScope(!!token,requestedDestination);
    const sources=collectionImportSources({kind,requests,collections:incoming});
    let count=0;
    if(sources.length){
      if(destination===STORAGE_WORKSPACE){
        count=await importCloudCollections(sources);
      }else{
        const added=sources.map(source=>toLocalCollection(source));
        setLocalCollections(validateLibrary([...localCollections,...added]));
        count=requests.length;
        setStorageScope(STORAGE_LOCAL);setExplorerTab('collections');setSidebarCollapsed(false);setPage('tester');
      }
    }else if(kind==='pakpost'&&requests.length){
      // A Pakpost session is a tab backup, not a collection import.
      stashActive();
      const tabs=requests.map(request=>{
        const id=`t${++tabSequence.current}`;
        const draft={...blankDraft(),...request,binaryFile:{name:request?.binaryFile?.name||'',base64:''},result:null,scriptLog:[],scriptTests:[],scriptError:''};
        draftsRef.current[id]=draft;
        return {id,name:request.name||'Imported Request',method:draft.method};
      });
      setOpenTabs(old=>[...old,...tabs]);
      const last=tabs.at(-1);
      activeTabRef.current=last.id;setActiveTabId(last.id);restoreDraft(draftsRef.current[last.id]);setPage('tester');
    }
    if(environments.length)await importPreparedEnvironments(environments,destination);
    const place=destination===STORAGE_WORKSPACE?'Cloud · Neon':'Local · Browser';
    if(kind==='pakpost')return `Restored ${requests.length} tab(s)${environments.length?` and imported ${environments.length} environment(s) into ${place}`:''}.`;
    return `Imported ${[count?`${count} request(s)`:null,environments.length?`${environments.length} environment(s)`:null].filter(Boolean).join(' and ')||'0 items'} into ${place}.`;
  }
  return { importPreparedEnvironments, importCloudCollections, importRequestsAndEnvironments };
}
