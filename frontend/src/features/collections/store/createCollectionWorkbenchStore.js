import { createStore } from 'zustand/vanilla';

// Collection state is scoped to a mounted workbench, not shared globally.
// Do NOT persist this store: Cloud endpoint metadata is private, and local
// collections already have a dedicated, redacted recovery path.
const resolveUpdate = (update, previous) => typeof update === 'function' ? update(previous) : update;

export function createCollectionWorkbenchStore(initial = {}) {
  return createStore((set) => ({
    collections: [],
    localCollections: initial.localCollections ?? [],
    selectedCol: '',
    savedRequests: [],
    collectionSort: initial.collectionSort ?? 'manual',
    expandedCollections: {},
    expandedWorkspaceExamples: {},
    localExpandAllSignal: null,
    revealLocalDraft: null,
    workspaceRequestLists: {},
    setCollections: (update) => set(s => ({ collections: resolveUpdate(update, s.collections) })),
    setLocalCollections: (update) => set(s => ({ localCollections: resolveUpdate(update, s.localCollections) })),
    setSelectedCol: (update) => set(s => ({ selectedCol: resolveUpdate(update, s.selectedCol) })),
    setSavedRequests: (update) => set(s => ({ savedRequests: resolveUpdate(update, s.savedRequests) })),
    setCollectionSort: (update) => set(s => ({ collectionSort: resolveUpdate(update, s.collectionSort) })),
    setExpandedCollections: (update) => set(s => ({ expandedCollections: resolveUpdate(update, s.expandedCollections) })),
    setExpandedWorkspaceExamples: (update) => set(s => ({ expandedWorkspaceExamples: resolveUpdate(update, s.expandedWorkspaceExamples) })),
    setLocalExpandAllSignal: (update) => set(s => ({ localExpandAllSignal: resolveUpdate(update, s.localExpandAllSignal) })),
    setRevealLocalDraft: (update) => set(s => ({ revealLocalDraft: resolveUpdate(update, s.revealLocalDraft) })),
    setWorkspaceRequestLists: (update) => set(s => ({ workspaceRequestLists: resolveUpdate(update, s.workspaceRequestLists) })),
    // Do not carry request cache, selections, or expandable Cloud metadata into
    // a different account/workspace. Async response epoch checks stay in App.
    clearWorkspaceData: () => set({
      collections: [], selectedCol: '', savedRequests: [],
      workspaceRequestLists: {}, expandedCollections: {}, expandedWorkspaceExamples: {},
    }),
  }));
}
