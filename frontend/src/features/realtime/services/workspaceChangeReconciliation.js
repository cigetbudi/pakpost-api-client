/** Bounded SignalR event processing. REST always remains the data source. */
import {CLIENT_INSTANCE_ID} from '../../../services/httpClient.js';
import {validWorkspaceEvent,shouldRefreshRequestList} from './workspaceEventPolicy.js';
import {isWorkspaceCollectionOpen,workspaceCollectionKey} from '../../collections/services/collectionExpansion.js';

export async function synchronizeWorkspaceChanges({events, workspaceId, token, isCurrent,
  tabs, selectedCollectionId, expandedCollections, requestLists,
  setCollections, setSelectedCollectionId, setRequestLists, setSelectedRequests,
  markConflict, reconcile, fetchCollections, fetchRequests, isSelectedCollection, isPagedCollection}) {
  if (!token || !workspaceId || !isCurrent()) return;
  const incoming = events.filter(event => validWorkspaceEvent(event,workspaceId)
    && event.sourceInstance !== CLIENT_INSTANCE_ID);
  if (!incoming.length) return;
  if (typeof window !== 'undefined') {
    const changedFolders = new Set(incoming.filter(event => event.kind.startsWith('folder.'))
      .map(event => event.collectionId));
    for (const collectionId of changedFolders)
      window.dispatchEvent(new CustomEvent('pakpost:cloud-folders-changed', {detail:{workspaceId,collectionId}}));
  }
  const updateCollections = incoming.some(event => event.kind.startsWith('collection.')
    || ['request.created','request.deleted','request.moved'].includes(event.kind));
  if (updateCollections) {
    try {
      const fresh = await fetchCollections(workspaceId,token);
      if (!isCurrent()) return;
      setCollections(fresh);
      setSelectedCollectionId(current => fresh.some(col => col.id === current) ? current : fresh[0]?.id || '');
      for (const event of incoming.filter(item => item.kind === 'collection.deleted')) {
        for (const tab of tabs) {
          if (tab.source?.scope === 'workspace' && tab.source.workspaceId === workspaceId
            && tab.source.collectionId === event.collectionId)
            markConflict(tab.id,{kind:'deleted',revision:null});
        }
        setRequestLists(old => {const next={...old};delete next[workspaceCollectionKey(workspaceId,event.collectionId)];return next;});
      }
    } catch { /* Keep the editor working if realtime sync is offline. */ }
  }
  // One index fetch per affected Collection, even if many requests changed.
  const affected = new Map();
  for (const event of incoming) {
    if (!event.kind.startsWith('request.')) continue;
    if (!affected.has(event.collectionId)) affected.set(event.collectionId, []);
    affected.get(event.collectionId).push(event);
  }
  const refreshes = [];
  const openCollectionIds = new Set(tabs.filter(tab => tab.source?.scope === 'workspace'
    && tab.source.workspaceId === workspaceId).map(tab => tab.source.collectionId));
  for (const [collectionId, changes] of affected) {
    const relevant = changes.at(-1);
    const cacheKey = workspaceCollectionKey(workspaceId, collectionId);
    const hasOpenTab = openCollectionIds.has(collectionId);
    const expanded = isWorkspaceCollectionOpen(expandedCollections,workspaceId,collectionId,selectedCollectionId);
    if (!shouldRefreshRequestList(relevant, {selectedCol:selectedCollectionId,
      cached:Object.hasOwn(requestLists,cacheKey),hasOpenTab,expanded})) continue;
    if (isPagedCollection?.(collectionId)) {
      // Large Collections must never re-fetch the complete request index in
      // response to SignalR. Refresh only mounted folder pages.
      setRequestLists(previous => {
        if (!Object.hasOwn(previous,cacheKey)) return previous;
        const next={...previous};delete next[cacheKey];return next;
      });
      if (isSelectedCollection ? isSelectedCollection(collectionId) : selectedCollectionId===collectionId)
        setSelectedRequests([]);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pakpost:cloud-paged-refresh',
        {detail:{workspaceId,collectionId}}));
      // An index page cannot safely reconcile every open tab: omitted records
      // would otherwise look deleted. Reconcile only the changed request ID.
      const unique = new Map(changes.filter(event=>event.requestId).map(event=>[event.requestId,event]));
      for (const event of unique.values()) {
        if (!isCurrent()) return;
        if (!tabs.some(tab=>tab.source?.scope==='workspace' && tab.source.workspaceId===workspaceId
          && tab.source.collectionId===collectionId && tab.source.requestId===event.requestId)) continue;
        if (event.kind==='request.updated' && Number.isInteger(event.revision) && event.revision>0)
          await reconcile(workspaceId,collectionId,[{id:event.requestId,revision:event.revision,isIndex:true}],
            {onlyRequestId:event.requestId});
        else if (event.kind==='request.deleted')
          await reconcile(workspaceId,collectionId,[],{onlyRequestId:event.requestId});
        else if (event.kind==='request.moved')
          for (const tab of tabs) if (tab.source?.scope==='workspace' && tab.source.workspaceId===workspaceId
            && tab.source.collectionId===collectionId && tab.source.requestId===event.requestId)
            markConflict(tab.id,{kind:'conflict',revision:event.revision||null});
      }
      continue;
    }
    refreshes.push({collectionId,cacheKey});
  }
  // Keep NeonDB connection use bounded when many Collections receive events.
  for (let i = 0; i < refreshes.length && isCurrent(); i += 3) {
    await Promise.all(refreshes.slice(i,i + 3).map(async ({collectionId,cacheKey}) => {
      try {
        const requests = await fetchRequests(workspaceId,collectionId,token);
        if (!isCurrent()) return;
        setRequestLists(old => ({...old,[cacheKey]:requests}));
        if (isSelectedCollection ? isSelectedCollection(collectionId) : selectedCollectionId === collectionId)
          setSelectedRequests(requests);
        await reconcile(workspaceId,collectionId,requests);
      } catch { /* Preserve last-known tree and drafts while offline. */ }
    }));
  }
}
