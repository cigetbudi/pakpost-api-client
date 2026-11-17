import { useStore } from 'zustand';

// Select primitives/slices individually (Zustand v5: no fresh object selector).
export function useCollectionWorkbench(store) {
  const collections = useStore(store, s => s.collections);
  const setCollections = useStore(store, s => s.setCollections);
  const localCollections = useStore(store, s => s.localCollections);
  const setLocalCollections = useStore(store, s => s.setLocalCollections);
  const selectedCol = useStore(store, s => s.selectedCol);
  const setSelectedCol = useStore(store, s => s.setSelectedCol);
  const savedRequests = useStore(store, s => s.savedRequests);
  const setSavedRequests = useStore(store, s => s.setSavedRequests);
  const collectionSort = useStore(store, s => s.collectionSort);
  const setCollectionSort = useStore(store, s => s.setCollectionSort);
  const expandedCollections = useStore(store, s => s.expandedCollections);
  const setExpandedCollections = useStore(store, s => s.setExpandedCollections);
  const expandedWorkspaceExamples = useStore(store, s => s.expandedWorkspaceExamples);
  const setExpandedWorkspaceExamples = useStore(store, s => s.setExpandedWorkspaceExamples);
  const localExpandAllSignal = useStore(store, s => s.localExpandAllSignal);
  const setLocalExpandAllSignal = useStore(store, s => s.setLocalExpandAllSignal);
  const revealLocalDraft = useStore(store, s => s.revealLocalDraft);
  const setRevealLocalDraft = useStore(store, s => s.setRevealLocalDraft);
  const workspaceRequestLists = useStore(store, s => s.workspaceRequestLists);
  const setWorkspaceRequestLists = useStore(store, s => s.setWorkspaceRequestLists);
  return {
    collections, setCollections, localCollections, setLocalCollections,
    selectedCol, setSelectedCol, savedRequests, setSavedRequests,
    collectionSort, setCollectionSort, expandedCollections, setExpandedCollections,
    expandedWorkspaceExamples, setExpandedWorkspaceExamples,
    localExpandAllSignal, setLocalExpandAllSignal, revealLocalDraft, setRevealLocalDraft,
    workspaceRequestLists, setWorkspaceRequestLists,
  };
}
