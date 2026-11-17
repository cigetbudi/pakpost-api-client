import { createStore } from 'zustand/vanilla';

// A scoped store is created for each mounted Workbench. Do not add persist:
// request metadata may identify private Cloud resources and script drafts can
// contain credentials. Existing redacted session recovery stays in App.
const nextValue = (value, previous) => typeof value === 'function' ? value(previous) : value;

export function createRequestWorkbenchStore(initial = {}) {
  return createStore((set) => ({
    openTabs: initial.openTabs ?? [],
    activeTabId: initial.activeTabId ?? 't1',
    reqTab: initial.reqTab ?? 'params',
    resTab: initial.resTab ?? 'body',
    setOpenTabs: (update) => set((state) => ({ openTabs: nextValue(update, state.openTabs) })),
    setActiveTabId: (update) => set((state) => ({ activeTabId: nextValue(update, state.activeTabId) })),
    setReqTab: (update) => set((state) => ({ reqTab: nextValue(update, state.reqTab) })),
    setResTab: (update) => set((state) => ({ resTab: nextValue(update, state.resTab) })),
  }));
}
