import { freshRequest } from '../../draftLifecycle.js';

/**
 * Preserve non-Cloud tabs on sign-out, but never depend on an existing saved
 * draft being present. Cache recovery may only contain the currently open tab.
 * No auth side effects occur in this function, which is independently tested.
 */
export function planSignedOutWorkbench(tabs, activeTabId, drafts, activeSnapshot) {
  const localTabs = (Array.isArray(tabs) ? tabs : []).filter(tab =>
    tab && tab.source?.scope !== 'workspace' && typeof tab.id === 'string');
  const fallback = { id: 't0', name: 'Untitled Request', method: 'GET', source: null };
  const nextTabs = localTabs.length ? localTabs : [fallback];
  const nextDrafts = {};
  for (const tab of nextTabs) {
    // An absent cached draft must never prevent sign-out.
    const source = tab.id === activeTabId ? activeSnapshot : drafts?.[tab.id];
    nextDrafts[tab.id] = source && typeof source === 'object'
      ? { ...freshRequest(tab.name || 'Untitled Request'), ...source }
      : freshRequest(tab.name || 'Untitled Request');
  }
  return { tabs: nextTabs, drafts: nextDrafts, activeTabId: nextTabs[0].id,
    activeDraft: nextDrafts[nextTabs[0].id] };
}

/** Always invalidate credentials first, even if browser storage is unavailable. */
export function invalidateBrowserSession(storage, clearRecovery) {
  try { storage?.removeItem('pakpost_token'); } catch { /* storage may be disabled */ }
  try { clearRecovery?.(); } catch { /* sign-out must still succeed */ }
}
