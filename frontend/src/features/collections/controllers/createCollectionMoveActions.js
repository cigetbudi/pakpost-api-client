import {readRequestDrag} from '../services/requestDrag.js';
import {arrangeCollections} from '../services/collectionHierarchy.js';

// Dedicated collection/folder/request placement actions.
// Keep local unsaved drafts and Cloud revision updates in their original flow.
export function createCollectionMoveActions(dependencies) {
  const {
    WORKSPACE_DRAG, api, applyLocalAction, canEditCloud, collections,
    currentTokenRef, getMessage, localCollections, refreshCloudCollection,
    selectedCol, selectedWorkspaceRef, selectedWs, setCollections,
    setLocalCollections, setNotice, setOpenTabs, setSavedRequests,
    setWorkspaceRequestLists, setWorkspaceSorted, token, updateLocal,
    validateLibrary, workspaceCollectionKey, workspaceRequestLists,
  } = dependencies;

  function invalidateWorkspaceRequestLists(workspaceId,ids) {
      setWorkspaceRequestLists(previous => {
        const next={...previous};
        for(const id of ids)delete next[workspaceCollectionKey(workspaceId,id)];
        return next;
      });
    }

  function moveLocalRequest({collectionId,requestId,targetCollectionId,targetFolderPath,beforeRequestId,placement}){
      updateLocal({type:'moveRequest',collectionId,requestId,targetCollectionId,targetFolderPath,beforeRequestId,placement});
      setOpenTabs(tabs=>tabs.map(tab=>tab.source?.scope==='local'&&
        tab.source.collectionId===collectionId&&tab.source.requestId===requestId?
        {...tab,source:{...tab.source,collectionId:targetCollectionId,
          folderPath:[...(targetFolderPath||[])]}}:tab));
    }

  function moveLocalFolder({collectionId,folderPath,targetCollectionId,targetFolderPath}) {
      const action={type:'moveFolder',collectionId,folderPath,targetCollectionId,targetFolderPath};
      try {
        const from=localCollections.find(item=>item.id===collectionId);
        const affected=new Set((from?.requests||[]).filter(request=>
          folderPath.every((name,index)=>request.folderPath?.[index]===name)).map(request=>request.id));
        setLocalCollections(applyLocalAction(localCollections,action));
        // Update open tabs and unsaved drafts too. Their source.folderPath is used
        // when saving, so leaving the old path would silently recreate the folder.
        const destination=[...targetFolderPath,folderPath.at(-1)];
        setOpenTabs(tabs=>tabs.map(tab=>{
          const source=tab.source;
          if(source?.scope!=='local'||source.collectionId!==collectionId)return tab;
          const path=Array.isArray(source.folderPath)?source.folderPath:[];
          const inMovedPath=folderPath.every((name,index)=>path[index]===name);
          if(!inMovedPath&&!affected.has(source.requestId))return tab;
          return {...tab,source:{...source,collectionId:targetCollectionId,
            folderPath:[...destination,...(inMovedPath?path.slice(folderPath.length):[])]}};
        }));
        setNotice('Local folder and its contents moved.');
      }catch(error){setNotice(getMessage(error));}
    }

  function moveLocalCollection(sourceId,targetId,placement){
      try{
        const next=arrangeCollections(localCollections,sourceId,targetId,placement);
        setLocalCollections(validateLibrary(next));
        setNotice('Local collection organization saved.');
      }catch(error){setNotice(getMessage(error));}
    }

  async function moveWorkspaceCollection(sourceId,targetId,placement){
      if(!token||!selectedWs||!canEditCloud)return;
      try{
        // Optimistically preserve nothing until the server confirms. A failed
        // authorization/cycle/concurrent write cannot corrupt the sidebar.
        await api(`/api/workspaces/${selectedWs}/collections/${sourceId}/placement`,
          'PATCH',{targetCollectionId:targetId||null,placement},token);
        const latest=await api(`/api/workspaces/${selectedWs}/collections`,'GET',undefined,token);
        if(selectedWorkspaceRef.current===selectedWs&&currentTokenRef.current===token)setCollections(latest);
        setNotice('Cloud collection organization saved.');
      }catch(error){setNotice(getMessage(error));}
    }

  async function moveWorkspaceFolder({workspaceId,collectionId,folderId,version,targetCollectionId,targetParentId=null}){
      if(!token||!selectedWs||!canEditCloud||workspaceId!==selectedWs)return;
      try{
        const moved=await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/folders/${folderId}/move`,
          'PATCH',{parentFolderId:targetParentId,version,targetCollectionId},token);
        if(targetCollectionId!==collectionId){
          const revisionById=new Map((moved.movedRequests||[]).map(item=>[item.id,item.revision]));
          if(revisionById.size)setOpenTabs(tabs=>tabs.map(tab=>tab.source?.scope==='workspace'&&
            tab.source.workspaceId===selectedWs&&tab.source.collectionId===collectionId&&
            revisionById.has(tab.source.requestId)?
            {...tab,source:{...tab.source,collectionId:targetCollectionId,
              revision:revisionById.get(tab.source.requestId)}}:tab));
        }
        invalidateWorkspaceRequestLists(selectedWs,[collectionId,targetCollectionId]);
        for(const id of new Set([collectionId,targetCollectionId])){
          window.dispatchEvent(new CustomEvent('pakpost:cloud-folders-changed',
            {detail:{workspaceId:selectedWs,collectionId:id}}));
          window.dispatchEvent(new CustomEvent('pakpost:cloud-paged-refresh',
            {detail:{workspaceId:selectedWs,collectionId:id}}));
        }
        const destinationIds=[...new Set([collectionId,targetCollectionId])];
        await Promise.all(destinationIds.map(async id=>{
          if(Number(collections.find(item=>item.id===id)?.requestCount)>800)return;
          const updated=await api(`/api/workspaces/${selectedWs}/collections/${id}/requests/index`,
            'GET',undefined,token);
          if(selectedWorkspaceRef.current!==selectedWs||currentTokenRef.current!==token)return;
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,id)]:updated}));
          if(selectedCol===id)setSavedRequests(updated);
        }));
        const fresh=await api(`/api/workspaces/${selectedWs}/collections`,'GET',undefined,token);
        if(selectedWorkspaceRef.current===selectedWs&&currentTokenRef.current===token)setCollections(fresh);
        setNotice('Cloud folder and all nested requests moved.');
      }catch(error){setNotice(getMessage(error));throw error;}
    }

  async function reorderWorkspaceRequest(collectionId,requestId,targetRequestId,placement){
      if(!token||!selectedWs||!canEditCloud||requestId===targetRequestId)return;
      try{
        await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/requests/${requestId}/reorder`,
          'PATCH',{targetRequestId,placement},token);
        setWorkspaceSorted(old=>({...old,[collectionId]:'manual'}));
        invalidateWorkspaceRequestLists(selectedWs,[collectionId]);
        await refreshCloudCollection(collectionId);
        window.dispatchEvent(new CustomEvent('pakpost:cloud-paged-refresh',
          {detail:{workspaceId:selectedWs,collectionId}}));
        setNotice('Endpoint order saved.');
      }catch(error){setNotice(getMessage(error));}
    }

  async function moveWorkspaceRequest(e,targetCollectionId,targetFolderId=null){
      e.preventDefault();e.stopPropagation();
      if(!token)return;
      try{
        const moved=readRequestDrag(e.dataTransfer,WORKSPACE_DRAG);
        if(!moved)return;
        const {collectionId,requestId}=moved;
        const sourceItem=(workspaceRequestLists[workspaceCollectionKey(selectedWs,collectionId)]||[])
          .find(item=>item.id===requestId);
        if(collectionId===targetCollectionId&&(sourceItem?.folderId||null)===(targetFolderId||null))return;
        const saved=await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/requests/${requestId}/move`,'PATCH',
          {targetCollectionId,targetFolderId},token);
        setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.workspaceId===selectedWs&&t.source.requestId===requestId?
          {...t,source:{...t.source,collectionId:targetCollectionId,revision:saved.revision}}:t));
        invalidateWorkspaceRequestLists(selectedWs,[collectionId,targetCollectionId]);
        if(selectedCol===collectionId&&Number(collections.find(col=>col.id===collectionId)?.requestCount)>800){
          window.dispatchEvent(new CustomEvent('pakpost:cloud-paged-refresh',
            {detail:{workspaceId:selectedWs,collectionId}}));
        }else if(selectedCol===collectionId){
          const latest=await api(`/api/workspaces/${selectedWs}/collections/${collectionId}/requests/index`,'GET',undefined,token);
          setSavedRequests(latest);
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:latest}));
        }
        setNotice('Request moved in workspace');
      }catch(err){setNotice(getMessage(err));}
    }

  return {
    invalidateWorkspaceRequestLists,
    moveLocalRequest, moveLocalFolder, moveLocalCollection,
    moveWorkspaceCollection, moveWorkspaceFolder, reorderWorkspaceRequest, moveWorkspaceRequest,
  };
}
