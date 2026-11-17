import { CLIENT_INSTANCE_ID } from '../../../services/httpClient.js';
import { validWorkspaceEvent, shouldRefreshRequestList } from './workspaceEventPolicy.js';
import { decideCloudTabSync } from '../../requests/services/cloudConflict.js';
import { isWorkspaceCollectionOpen, workspaceCollectionKey } from '../../collections/services/collectionExpansion.js';
import { freshRequest, tabSaved } from '../../requests/services/draftLifecycle.js';

/**
 * A side-effect boundary for the SignalR-to-REST reconciliation workflow.
 * The UI supplies state selectors/setters; this service owns event validation,
 * batching semantics, stale-response guards and safe tab reconciliation.
 * Workspace payloads are refetched over authorized REST, never over SignalR.
 */
export function reconcileRequestTabs({workspaceId, collectionId, requests, tabs, activeTabId,
  readDraft, transformRemote, markConflict, updateDraft, updateTab, restoreActive, clearConflict}) {
  for (const tab of tabs) {
    const src = tab.source;
    if (src?.scope !== 'workspace' || src.pending || src.workspaceId !== workspaceId || src.collectionId !== collectionId) continue;
    const remote = requests.find(row => row.id === src.requestId);
    const current = readDraft(tab.id);
    const decision = decideCloudTabSync(tab, current, remote);
    if (decision === 'none') continue;
    if (decision === 'conflict' || decision === 'deleted') {
      markConflict(tab.id, { kind: decision, revision: remote?.revision || null });
      continue;
    }
    const previous = current || freshRequest(remote.name);
    const updated = { ...freshRequest(remote.name), ...transformRemote(remote),
      result: previous.result, scriptLog: previous.scriptLog, scriptTests: previous.scriptTests,
      reqTab: previous.reqTab, resTab: previous.resTab };
    updateDraft(tab.id, updated);
    updateTab(tab.id, old => ({ ...tabSaved(old, {...src, revision:remote.revision}, updated, remote.name), method:remote.method }));
    clearConflict(tab.id);
    if (tab.id === activeTabId) restoreActive(updated);
  }
}

export async function synchronizeWorkspaceChanges({events, workspaceId, token, isCurrent,
  tabs, selectedCollectionId, expandedCollections, requestLists,
  setCollections, setSelectedCollectionId, setRequestLists, setSelectedRequests,
  markConflict, reconcile, fetchCollections, fetchRequests}) {
  if (!token || !workspaceId || !isCurrent()) return;
  const incoming = events.filter(event => validWorkspaceEvent(event,workspaceId)
    && event.sourceInstance !== CLIENT_INSTANCE_ID);
  if (!incoming.length) return;
  if(typeof window!=='undefined') for(const event of incoming.filter(e=>e.kind.startsWith('folder.')))
    window.dispatchEvent(new CustomEvent('pakpost:cloud-folders-changed',{detail:{workspaceId,collectionId:event.collectionId}}));
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
  const affected = new Set(incoming.filter(event => event.kind.startsWith('request.')).map(event => event.collectionId));
  for (const collectionId of affected) {
    if (!isCurrent()) return;
    const relevant = incoming.find(event => event.collectionId === collectionId && event.kind.startsWith('request.'));
    const cacheKey = workspaceCollectionKey(workspaceId,collectionId);
    const hasOpenTab = tabs.some(tab => tab.source?.scope === 'workspace' && tab.source.workspaceId === workspaceId && tab.source.collectionId === collectionId);
    const expanded = isWorkspaceCollectionOpen(expandedCollections, workspaceId, collectionId, selectedCollectionId);
    if (!shouldRefreshRequestList(relevant,{selectedCol:selectedCollectionId,cached:Object.hasOwn(requestLists,cacheKey),hasOpenTab,expanded})) continue;
    try {
      const requests = await fetchRequests(workspaceId,collectionId,token);
      if (!isCurrent()) return;
      setRequestLists(old => ({...old,[cacheKey]:requests}));
      if (selectedCollectionId === collectionId) setSelectedRequests(requests);
      reconcile(workspaceId,collectionId,requests);
    } catch { /* Preserve last-known tree and drafts while offline. */ }
  }
}
