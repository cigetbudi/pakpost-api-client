/**
 * Desktop Cloud convergence fallback.
 * Tauri keeps PakPostDesktop credentials in Rust: do not pass tokens to WebView
 * SignalR. Poll authenticated REST via remote_api and reconcile only changed
 * indexes. Local workspaces never invoke this service.
 */
import {workspaceCollectionKey} from '../../collections/services/collectionExpansion.js';
import {CLOUD_SERVER_PAGING_THRESHOLD} from '../../collections/services/cloudRenderBudget.js';

function signature(items) {
  // Include ordering, revisions, folders and metadata (without leaking drafts).
  return JSON.stringify(items);
}

export async function pollDesktopWorkspace({workspaceId,token,checkpoint,isCurrent,
  fetchCollections,fetchRequests,selectedCollectionId,openTabs,requestLists,
  setCollections,setSelectedCollectionId,setRequestLists,setSelectedRequests,
  reconcile,markConflict}) {
  if(!isCurrent() || !token || !workspaceId) return;
  const fresh = await fetchCollections(workspaceId,token);
  if(!Array.isArray(fresh) || !isCurrent()) return;
  const freshSignature=signature(fresh);
  if(checkpoint.collections !== freshSignature) {
    const removed = checkpoint.knownCollectionIds
      ? checkpoint.knownCollectionIds.filter(id=>!fresh.some(c=>c.id===id)) : [];
    if(!isCurrent())return;
    setCollections(fresh);
    setSelectedCollectionId(current=>fresh.some(c=>c.id===current)?current:(fresh[0]?.id||''));
    for(const id of removed) {
      for(const tab of openTabs) if(tab.source?.scope==='workspace' &&
        tab.source.workspaceId===workspaceId && tab.source.collectionId===id)
        markConflict(tab.id,{kind:'deleted',revision:null});
      setRequestLists(old=>{const next={...old};delete next[workspaceCollectionKey(workspaceId,id)];return next;});
    }
    checkpoint.collections=freshSignature;
    checkpoint.knownCollectionIds=fresh.map(c=>c.id);
  }
  // An active/expanded collection and saved open tabs are more important than
  // collapsed collections. Other cached indexes converge on subsequent cycles.
  const ids=new Set();
  if(selectedCollectionId)ids.add(selectedCollectionId);
  for(const tab of openTabs) if(tab.source?.scope==='workspace' && tab.source.workspaceId===workspaceId)
    ids.add(tab.source.collectionId);
  for(const col of fresh) if(Object.hasOwn(requestLists,workspaceCollectionKey(workspaceId,col.id))) ids.add(col.id);
  const eligible=[...ids].filter(id=>fresh.some(c=>c.id===id));
  if(eligible.length>1) {
    const selected=eligible.indexOf(selectedCollectionId);
    if(selected>0)eligible.unshift(eligible.splice(selected,1)[0]);
  }
  const others=eligible.slice(1);
  const start=checkpoint.cursor % Math.max(others.length,1);
  const chosen=[...eligible.slice(0,1),...Array.from({length:Math.min(3,others.length)},(_,i)=>others[(start+i)%others.length])];
  checkpoint.cursor=(start+3)%Math.max(others.length,1);
  for(const id of chosen) {
    if(!isCurrent())return;
    const col=fresh.find(c=>c.id===id);
    if(Number(col?.requestCount)>CLOUD_SERVER_PAGING_THRESHOLD) {
      // Do not fetch entire index for very large collections; refreshing a
      // visible paged tree on count changes avoids runaway NeonDB queries.
      const count=Number(col.requestCount);
      if(checkpoint.pagedCounts.has(id) && checkpoint.pagedCounts.get(id)!==count)
        window.dispatchEvent(new CustomEvent('pakpost:cloud-paged-refresh', {detail:{workspaceId,collectionId:id}}));
      checkpoint.pagedCounts.set(id,count);
      continue;
    }
    const requests=await fetchRequests(workspaceId,id,token);
    if(!Array.isArray(requests)||!isCurrent())return;
    const key=workspaceCollectionKey(workspaceId,id);
    const nextSig=signature(requests);
    if(checkpoint.indexes.get(id)===nextSig)continue;
    checkpoint.indexes.set(id,nextSig);
    setRequestLists(old=>({...old,[key]:requests}));
    if(selectedCollectionId===id)setSelectedRequests(requests);
    await reconcile(workspaceId,id,requests);
  }
}
