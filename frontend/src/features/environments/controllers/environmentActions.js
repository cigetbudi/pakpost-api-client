// Feature controller. Actions execute with the current Workbench context supplied
// by App; no global state, persistence middleware or extra network requests.
export function createEnvironmentActions(dependencies) {
  const {
    STORAGE_WORKSPACE, allowedStorageScope, api, currentEnvironments, documentation, downloadJson, envScope,
    exportChoice, exportFormat, exportIncludeSecrets, getMessage, importPreparedEnvironments, isSensitiveVariable, localCollections,
    parseEnvironmentDocument, readSavedCollectionVariables, rememberSessionValues, selectedWs, setActiveEnvId, setCreatingLocalCollection, setExportChoice,
    setExportFormat, setExportIncludeSecrets, setLocalEnvironments, setNotice, setStorageScope, setWorkspaceEnvironments, token,
    workspaceCollectionDocs, workspaceDocKey, workspaceDraft,
  } = dependencies;
  function updateStorageScope(scope){
    setStorageScope(allowedStorageScope(!!token,scope));
    // Keep each context's selection while switching Local, Cloud and workspaces.
    setCreatingLocalCollection(false);
  }
  async function importEnvironmentFile(sourceText,requestedDestination){
    let doc;
    try{doc=JSON.parse(sourceText)}catch{throw Error('Invalid JSON environment file. Use Postman, Hoppscotch or Insomnia v4 JSON (not YAML).');}
    const imported=parseEnvironmentDocument(doc);
    if(!imported?.length)throw Error('No supported environments found. Choose a Postman, Hoppscotch or Insomnia v4 JSON environment export.');
    const destination=allowedStorageScope(!!token,requestedDestination);
    const count=await importPreparedEnvironments(imported,destination);
    setNotice(`Imported ${count} environment(s) into ${destination===STORAGE_WORKSPACE?'Cloud · Neon':'Local · Browser'}.`);
  }
  async function createEnvironment(name){
    if(envScope==='workspace'){
      if(!selectedWs||!token)throw new Error('Sign in and choose a workspace');
      const env=await api(`/api/workspaces/${selectedWs}/environments`,'POST',{name},token);
      setWorkspaceEnvironments(v=>[...v,env]);setActiveEnvId(env.id);return env;
    }else{const env={id:crypto.randomUUID(),name,variables:[]};setLocalEnvironments(v=>[...v,env]);setActiveEnvId(env.id);return env;}
  }
  async function duplicateEnvironment(source){
    let nextName=`${source.name} (copy)`;let sequence=2;
    while(currentEnvironments.some(x=>x.name.toLowerCase()===nextName.toLowerCase()))nextName=`${source.name} (copy ${sequence++})`;
    const created=await createEnvironment(nextName);
    // A failed update is not silently treated as a successful duplicate.
    await persistEnvironment({...created,name:nextName,variables:(source.variables||[]).map(v=>({...v}))});
    setNotice(`Duplicated ${source.name}`);
    return created;
  }
  function openExportChoice(choice){
    setExportFormat('postman');setExportIncludeSecrets(false);setExportChoice(choice);
  }
  async function confirmExport(){
    if(!exportChoice)return;
    try{
      // Export formats (Postman/OpenAPI/Insomnia) are not required to open
      // PakPost or send a request; load the converters only when exporting.
      const {exportCollectionByFormat,exportEnvironmentByFormat,exportFileName}=await import('../../import-export/services/exportFormats.js');
      const {kind,scope,collectionId,environment,name}=exportChoice;
      if(kind==='environment'){
        downloadJson(exportEnvironmentByFormat(environment,{format:exportFormat,includeSecrets:exportIncludeSecrets}),exportFileName(name,exportFormat,'environment'));
      }else{
        let drafts,localCollection=null;
        if(scope==='local'){
          localCollection=localCollections.find(c=>c.id===collectionId);
          if(!localCollection)throw new Error('Collection no longer exists');
          drafts=localCollection.requests||[];
        }else{
          const list=await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/requests`,'GET',undefined,token);
          const {folderPathForId}=await import('../../collections/services/cloudFolderTree.js');
          const folders=await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/folders`,'GET',undefined,token);
          drafts=list.map(r=>({...workspaceDraft(r),requestName:r.name,folderPath:folderPathForId(folders,r.folderId)}));
          localCollection={name,documentation:workspaceCollectionDocs[workspaceDocKey(selectedWs,collectionId)]||'',
            folderPaths:folders.map(folder=>folderPathForId(folders,folder.id)),folderDocs:{},requests:drafts};
        }
        const documentation=scope==='workspace'?workspaceCollectionDocs[workspaceDocKey(selectedWs,collectionId)]||'':'';
        const output=exportCollectionByFormat(drafts,{name,format:exportFormat,includeSecrets:exportIncludeSecrets,localCollection,documentation});
        if(scope==='workspace'&&exportFormat==='postman'){
          const cloudVars=await readSavedCollectionVariables({scope:'workspace',workspaceId:selectedWs,collectionId},{reload:true});
          output.variable=(cloudVars.variables||[]).map(v=>({key:v.key,value:v.isRedacted||v.isSecret&&!exportIncludeSecrets?'':v.value,type:v.isSecret?'secret':'string'}));
        }
        downloadJson(output,exportFileName(name,exportFormat));
      }
      setNotice(`Exported ${name} as ${exportFormat==='openapi'?'OpenAPI 3.1':exportFormat==='insomnia'?'Insomnia v4':'Postman'}`);setExportChoice(null);
    }catch(e){setNotice(`Export failed: ${getMessage(e)}`);}
  }
  async function persistEnvironment(env){
    if(envScope==='workspace'){
      const saved=await api(`/api/workspaces/${selectedWs}/environments/${env.id}`,'PUT',{name:env.name,variables:env.variables},token);
      setWorkspaceEnvironments(v=>v.map(x=>x.id===saved.id?saved:x));
    }else setLocalEnvironments(v=>v.map(x=>x.id===env.id?env:x));
    setNotice('Environment saved');
  }
  async function deleteEnvironment(id){
    if(envScope==='workspace'){
      await api(`/api/workspaces/${selectedWs}/environments/${id}`,'DELETE',undefined,token);
      setWorkspaceEnvironments(v=>v.filter(x=>x.id!==id));
    }else setLocalEnvironments(v=>v.filter(x=>x.id!==id));
    setActiveEnvId('');
  }
  async function applyScriptVariables(values,runEnvironment){
    const {environment,scope,sessionKey,canWrite,initialValues}=runEnvironment;
    if(!environment||JSON.stringify(initialValues)===JSON.stringify(values))return;
    if(scope===STORAGE_WORKSPACE&&!canWrite){
      // QA, Writer and Developer (without environment.write): pm.environment.set/unset
      // updates only a personal in-memory overlay; never calls the Cloud PUT endpoint.
      rememberSessionValues(sessionKey,environment,values);
      return;
    }
    const old=environment.variables;
    const merged=Object.entries(values).map(([key,value])=>({key,value:String(value),isSecret:old.find(x=>x.key===key)?.isSecret||isSensitiveVariable(key)}));
    // This preserves the existing persistence behavior for Local and authorized Cloud editors.
    await persistEnvironment({...environment,variables:merged});
  }
  return { updateStorageScope, importEnvironmentFile, createEnvironment, duplicateEnvironment, openExportChoice, confirmExport, persistEnvironment, deleteEnvironment, applyScriptVariables };
}
