/** Clean Cloud tab reconciliation; never overwrite drafts with index DTOs. */
import {decideCloudTabSync} from '../../requests/services/cloudConflict.js';
import {freshRequest,tabSaved} from '../../requests/services/draftLifecycle.js';

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
