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
  const byId = new Map(requests.map(request => [request.id, request]));
  for (const tab of tabs) {
    const src = tab.source;
    if (src?.scope !== 'workspace' || src.pending || src.workspaceId !== workspaceId || src.collectionId !== collectionId) continue;
    const remote = byId.get(src.requestId);
    const current = readDraft(tab.id);
    const decision = decideCloudTabSync(tab, current, remote);
    if (decision === 'none') continue;
    // Index DTOs omit Body, FormFields and Scripts. Never replace an editor
    // draft with an index record, even when the revision is newer.
    if (decision === 'reload' && remote?.isIndex) continue;
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

/** Fetch full payload only for clean, open tabs with a newer index revision.
 * No persistent browser cache: decrypted details live only in the workbench RAM.
 */
export async function hydrateOpenCloudDetails({workspaceId, collectionId, requests, tabs,
  readDraft, fetchDetail, isCurrent, concurrency = 4}) {
  const index = new Map(requests.map(request => [request.id, request]));
  const ids = new Set();
  for (const tab of tabs) {
    const source = tab.source;
    if (source?.scope !== 'workspace' || source.pending || source.workspaceId !== workspaceId
      || source.collectionId !== collectionId) continue;
    const remote = index.get(source.requestId);
    if (remote?.isIndex && decideCloudTabSync(tab, readDraft(tab.id), remote) === 'reload')
      ids.add(source.requestId);
  }
  if (!ids.size) return requests;
  const hydrated = new Map();
  const pending = [...ids];
  let cursor = 0;
  await Promise.all(Array.from({length: Math.min(Math.max(1, concurrency), pending.length)}, async () => {
    while (isCurrent() && cursor < pending.length) {
      const requestId = pending[cursor++];
      try {
        const full = await fetchDetail(requestId);
        const summary = index.get(requestId);
        if (full && !full.isIndex && full.id === requestId && full.revision >= summary.revision)
          hydrated.set(requestId, full);
      } catch { /* Do not replace the editor with incomplete data when offline. */ }
    }
  }));
  if (!isCurrent()) return null;
  return requests.map(request => hydrated.get(request.id) || request);
}

export async function synchronizeWorkspaceChanges({events, workspaceId, token, isCurrent,
  tabs, selectedCollectionId, expandedCollections, requestLists,
  setCollections, setSelectedCollectionId, setRequestLists, setSelectedRequests,
  markConflict, reconcile, fetchCollections, fetchRequests, isSelectedCollection}) {
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
    if (event.kind.startsWith('request.')) affected.set(event.collectionId, event);
  }
  const refreshes = [];
  const openCollectionIds = new Set(tabs.filter(tab => tab.source?.scope === 'workspace'
    && tab.source.workspaceId === workspaceId).map(tab => tab.source.collectionId));
  for (const [collectionId, relevant] of affected) {
    const cacheKey = workspaceCollectionKey(workspaceId, collectionId);
    const hasOpenTab = openCollectionIds.has(collectionId);
    const expanded = isWorkspaceCollectionOpen(expandedCollections,workspaceId,collectionId,selectedCollectionId);
    if (!shouldRefreshRequestList(relevant, {selectedCol:selectedCollectionId,
      cached:Object.hasOwn(requestLists,cacheKey),hasOpenTab,expanded})) continue;
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
