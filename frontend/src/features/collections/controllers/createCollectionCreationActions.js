// Create Local/Cloud collections and import a collection document.
export function createCollectionCreationActions(dependencies) {
  const {
    STORAGE_LOCAL, STORAGE_WORKSPACE, allowedStorageScope, api, busyAction,
    canEditCloud, collectionImportBusy, collectionImportDestination, collectionImportFile, collectionImportSources,
    collections, doAction, getMessage, importRequestsAndEnvironments, localCollectionName,
    localCollections, parseImportText, selectedWs, setCollectionImportBusy, setCollectionImportDestination,
    setCollectionImportError, setCollectionImportFile, setCollectionImportOpen, setCollections, setCreatingLocalCollection,
    setLocalCollectionName, setLocalCollections, setNotice, setSelectedCol, storageScope,
    toLocalCollection, token, validateLibrary,
  } = dependencies;

  async function createExplorerCollection(e){
      e.preventDefault();
      const name=localCollectionName.trim();if(!name||busyAction)return;
      if(storageScope===STORAGE_WORKSPACE&&token){
        if(!selectedWs){setNotice('Select a workspace before creating a Cloud collection.');return;}
        await doAction(async()=>{
          const created=await api(`/api/workspaces/${selectedWs}/collections`,'POST',{name},token);
          setCollections(current=>[...current,created]);
          setSelectedCol(created.id);
          setLocalCollectionName('');setCreatingLocalCollection(false);
          setNotice('Cloud collection created.');
        });
      }else{
        try{
          const next=toLocalCollection({name,requests:[]});
          next.sortOrder=1+Math.max(0,...localCollections.filter(item=>!item.parentCollectionId).map(item=>Number(item.sortOrder)||0));
          setLocalCollections(validateLibrary([...localCollections,next]));
          setLocalCollectionName('');setCreatingLocalCollection(false);
        }
        catch(err){setNotice(getMessage(err));}
      }
    }
  function openCollectionImport(){
      setCollectionImportDestination(token&&canEditCloud?STORAGE_WORKSPACE:STORAGE_LOCAL);
      setCollectionImportFile(null);setCollectionImportError('');setCollectionImportOpen(true);
    }
  async function submitCollectionImport(){
      if(!collectionImportFile||collectionImportBusy)return;
      setCollectionImportBusy(true);setCollectionImportError('');
      try{
        const parsed=parseImportText(await collectionImportFile.text());
        if(parsed.kind==='environment'||(parsed.kind==='pakpost'&&!parsed.requests?.length))
          throw Error('This file has no collections. Use Environments or Import / Export to import it.');
        if(!collectionImportSources(parsed).length)
          throw Error('This file has no HTTP collections. Choose Postman, OpenAPI, Insomnia v4 JSON or cURL.');
        if(collectionImportDestination===STORAGE_WORKSPACE&&!canEditCloud)
          throw Error('You cannot import Cloud collections with your current workspace roles. Choose Local.');
        const message=await importRequestsAndEnvironments(parsed,allowedStorageScope(!!token,collectionImportDestination));
        setNotice(message);setCollectionImportOpen(false);setCollectionImportFile(null);
      }catch(error){setCollectionImportError(getMessage(error));}
      finally{setCollectionImportBusy(false);}
    }

  return { createExplorerCollection, openCollectionImport, submitCollectionImport };
}
