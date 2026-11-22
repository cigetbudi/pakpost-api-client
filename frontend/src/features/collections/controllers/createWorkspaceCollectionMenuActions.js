import { folderPathForId } from '../services/cloudFolderTree.js';

/** Workspace collection context menus and duplication; Cloud RBAC stays server-side. */
export function createWorkspaceCollectionMenuActions({
  EMPTY_HEADER, api, blankDraft, collections, createCollectionDraft,
  decodeStoredHeaders, doAction, invalidateWorkspaceRequestLists,
  openCollectionRunner, openCollectionVariables, openDocumentation,
  openExportChoice, readSavedCollectionVariables, selectedCol, selectedWs,
  setActionDialog, setActionName, setCollections, setExpandedCollections,
  setSavedRequests, setWorkspaceCollectionDocs, setWorkspaceMenu,
  setWorkspaceRequestLists, setWorkspaceSorted, token,
  workspaceCollectionKey, workspaceDocKey,
}) {
  function showWorkspaceMenu(e,item){
      e.preventDefault();e.stopPropagation();
      const rect=e.currentTarget.getBoundingClientRect();
      setWorkspaceMenu({...item,x:Math.max(8,Math.min(e.clientX||rect.right,window.innerWidth-245)),y:Math.max(8,Math.min(e.clientY||rect.bottom,window.innerHeight-365))});
    }

  function workspaceDraft(item){
      const saved=decodeStoredHeaders(item.headersJson);
      let fields=[];try{fields=JSON.parse(item.formFieldsJson||'[]')}catch{}
      return {...blankDraft(),...item,rows:[...saved.headers,{...EMPTY_HEADER}],params:saved.params.length?saved.params:[{...EMPTY_HEADER}],documentation:saved.documentation,responseExamples:saved.responseExamples,...saved.auth,format:item.contentType||'application/json',
        formFields:fields,preScript:item.preRequestScript||'',postScript:item.postResponseScript||''};
    }

  async function handleWorkspaceMenu(action,item){
      setWorkspaceMenu(null);
      if(action==='renameExample'||action==='deleteExample'){
        setActionName(item.name||'');setActionDialog({scope:'workspace',action,...item});return;
      }
      if(action==='variables'){openCollectionVariables({scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId,name:collections.find(c=>c.id===item.collectionId)?.name||item.name});return;}
      if(action==='runCollection'){openCollectionRunner({scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId,name:collections.find(c=>c.id===item.collectionId)?.name||item.name});return;}
      if(action==='documentation'){openDocumentation({scope:'workspace',type:item.type==='request'?'request':'collection',collectionId:item.collectionId,requestId:item.requestId,name:item.name});return;}
      if(action==='renameCollection'||action==='deleteCollection'||action==='renameRequest'||action==='deleteRequest'){
        setActionName(item.name||'');setActionDialog({scope:'workspace',action,...item});return;
      }
      if(action==='exportCollection'){
        openExportChoice({kind:'collection',scope:'workspace',collectionId:item.collectionId,name:collections.find(c=>c.id===item.collectionId)?.name||'Workspace collection'});return;
      }
      if(action==='newRequest'){
        createCollectionDraft('workspace',item.collectionId);
        return;
      }
      if(action==='newFolder'){
        setExpandedCollections(old=>({...old,[workspaceCollectionKey(selectedWs,item.collectionId)]:true}));
        window.dispatchEvent(new CustomEvent('pakpost:cloud-create-folder',{
          detail:{workspaceId:selectedWs,collectionId:item.collectionId}
        }));
        return;
      }
      const base=`/api/workspaces/${selectedWs}/collections`;
      await doAction(async()=>{
        if(action==='sortCollection'){
          setWorkspaceSorted(old=>({...old,[item.collectionId]:'name'}));
          return;
        }
        const list=await api(`${base}/${item.collectionId}/requests`,'GET',undefined,token);
        if(action==='duplicateCollection'){
          if(list.length>100)throw Error('Duplicate limit: 100 saved requests');
          const source=collections.find(c=>c.id===item.collectionId);
          const folders=await api(`${base}/${item.collectionId}/folders`,'GET',undefined,token);
          const variables=await readSavedCollectionVariables({scope:'workspace',workspaceId:selectedWs,collectionId:item.collectionId});
          // The same atomic import endpoint handles copies; unlike the previous
          // POST loop, failures never leave a half-created Cloud collection.
          const result=await api(`${base}/import`,'POST',{collections:[{
            name:`${source?.name||'Collection'} (copy)`,
            variables:(variables.variables||[]).filter(v=>!v.isRedacted),
            requests:list.map(req=>({name:req.name,method:req.method,url:req.url,headersJson:req.headersJson,
              body:req.body,bodyMode:req.bodyMode,contentType:req.contentType,formFieldsJson:req.formFieldsJson,
              preRequestScript:req.preRequestScript,postResponseScript:req.postResponseScript,
              folderPath:folderPathForId(folders,req.folderId)}))
          }]},token);
          const destinationId=result.firstId;
          if(destinationId)setWorkspaceCollectionDocs(old=>({...old,
            [workspaceDocKey(selectedWs,destinationId)]:old[workspaceDocKey(selectedWs,item.collectionId)]||''}));
          setCollections(await api(base,'GET',undefined,token));return;
        }
        if(action==='duplicateRequest'){
          const req=list.find(x=>x.id===item.requestId);if(!req)return;
          await api(`${base}/${item.collectionId}/requests`,'POST',
            {name:`${req.name} (copy)`,method:req.method,url:req.url,headersJson:req.headersJson,body:req.body,bodyMode:req.bodyMode,contentType:req.contentType,formFieldsJson:req.formFieldsJson,preRequestScript:req.preRequestScript,postResponseScript:req.postResponseScript,folderId:req.folderId},token);
          invalidateWorkspaceRequestLists(selectedWs,[item.collectionId]);
          if(selectedCol===item.collectionId){
            if(Number(collections.find(col=>col.id===item.collectionId)?.requestCount)>800){
              window.dispatchEvent(new CustomEvent('pakpost:cloud-paged-refresh',
                {detail:{workspaceId:selectedWs,collectionId:item.collectionId}}));
            }else{
              const latest=await api(`${base}/${item.collectionId}/requests/index`,'GET',undefined,token);
              setSavedRequests(latest);
              setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,item.collectionId)]:latest}));
            }
          }
          setCollections(await api(base,'GET',undefined,token));
        }
      });
    }  return { showWorkspaceMenu, workspaceDraft, handleWorkspaceMenu };
}
