import { renameActionError } from '../services/renameValidation.js';

/** Collection and saved-request dialog mutations (Local and Cloud). */
export function createCollectionDialogActions({
  actionDialog, actionName, activeTabRef, adoptSavedRevision, api, collections,
  decodeStoredHeaders, doAction, draftsRef, encodeStoredHeaders, getMessage,
  localCollections, openTabs, renameSavedExample, requestFingerprint,
  savedRequests, selectedCol, selectedWs, setActionDialog, setCollections,
  setNotice, setOpenTabs, setResponseExamples, setSavedRequests, setSelectedCol,
  setWorkspaceRequestLists, snapshot, token, updateLocal, workspaceCollectionKey,
  workspaceRequestLists,
}) {
  async function executeActionDialog(e){
      e.preventDefault();if(!actionDialog)return;
      const {scope,action,collectionId,requestId,folderPath}=actionDialog;
      const name=actionName.trim();
      if(action.startsWith('rename')&&renameActionError(actionDialog,name,{collections,localCollections,workspaceRequestLists,selectedWs,workspaceCollectionKey}))return;
      if(action==='renameExample'){
        const success=await doAction(async()=>{
          await renameSavedExample(actionDialog,name);
          setNotice(`Renamed example to ${name}`);
        });
        if(success)setActionDialog(null);
        return;
      }
      if(scope==='local')updateLocal({type:action,collectionId,requestId,folderPath,name});
      else { const success=await doAction(async()=>{
        const base=`/api/workspaces/${selectedWs}/collections/${collectionId}`;
        if(action==='renameCollection'){
          await api(base,'PUT',{name},token);setCollections(await api(`/api/workspaces/${selectedWs}/collections`,'GET',undefined,token));
        }else if(action==='deleteCollection'){
          await api(base,'DELETE',undefined,token);setCollections(old=>old.filter(c=>c.id!==collectionId));
          setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.collectionId===collectionId&&t.source.workspaceId===selectedWs?{...t,source:null}:t));
          if(selectedCol===collectionId)setSelectedCol('');
        }else if(action==='renameRequest'){
          const item=(workspaceRequestLists[workspaceCollectionKey(selectedWs,collectionId)]||savedRequests).find(x=>x.id===requestId);if(!item)return;
          const original=item.isIndex
            ?await api(`${base}/requests/${requestId}`,'GET',undefined,token)
            :item;
          const saved=await api(`${base}/requests/${requestId}`,'PUT',{...original,name},token);
          adoptSavedRevision(saved);
          setSavedRequests(old=>old.map(x=>x.id===requestId?saved:x));
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:(old[workspaceCollectionKey(selectedWs,collectionId)]||[]).map(x=>x.id===requestId?saved:x)}));
          setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.requestId===requestId?{...t,name,savedName:name,source:{...t.source,revision:saved.revision},savedFingerprint:requestFingerprint(t.id===activeTabRef.current?snapshot():draftsRef.current[t.id],name)}:t));
        }else if(action==='deleteRequest'){
          await api(`${base}/requests/${requestId}`,'DELETE',undefined,token);
          setOpenTabs(ts=>ts.map(t=>t.source?.scope==='workspace'&&t.source.requestId===requestId?{...t,source:null}:t));
          setSavedRequests(old=>old.filter(x=>x.id!==requestId));
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:(old[workspaceCollectionKey(selectedWs,collectionId)]||[]).filter(x=>x.id!==requestId)}));
        }else if(action==='deleteExample'){
          const list=await api(`${base}/requests`,'GET',undefined,token);
          const original=list.find(x=>x.id===requestId);
          if(!original)throw Error('Saved request not found');
          const metadata=decodeStoredHeaders(original.headersJson);
          const examples=metadata.responseExamples.filter(example=>example.id!==actionDialog.exampleId);
          const saved=await api(`${base}/requests/${requestId}`,'PUT',{
            ...original,headersJson:encodeStoredHeaders(metadata.headers,metadata.params,metadata.documentation,examples,metadata.auth)
          },token);
          adoptSavedRevision(saved);
          const updated=list.map(req=>req.id===requestId?saved:req);
          setWorkspaceRequestLists(old=>({...old,[workspaceCollectionKey(selectedWs,collectionId)]:updated}));
          if(selectedCol===collectionId)setSavedRequests(updated);
          const affected=openTabs.filter(tab=>tab.source?.scope==='workspace'&&tab.source.workspaceId===selectedWs&&tab.source.collectionId===collectionId&&tab.source.requestId===requestId);
          for(const tab of affected){
            if(draftsRef.current[tab.id])draftsRef.current[tab.id]={...draftsRef.current[tab.id],responseExamples:examples};
            if(tab.id===activeTabRef.current)setResponseExamples(examples);
          }
        }
      }); if(!success)return; }
      setActionDialog(null);
    }  return { executeActionDialog };
}
