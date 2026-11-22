import {useMemo} from 'react';
import {sortCollectionRoots} from '../services/collectionSort.js';
import {workspaceCollectionKey} from '../services/collectionExpansion.js';

/** Editor keystrokes must not re-sort thousands of collection entries. */
export function useVisibleWorkbenchCollections({
  collections,workspaceRequestLists,explorerSearch,collectionSort,selectedWs,localCollections,
}) {
  const visibleCollections = useMemo(() => {
    const term = explorerSearch.trim().toLowerCase();
    const matching = !term ? collections : collections.filter(collection =>
      collection.name.toLowerCase().includes(term) ||
      (workspaceRequestLists[workspaceCollectionKey(selectedWs, collection.id)] || []).some(request =>
        `${request.name || ''} ${request.url || ''}`.toLowerCase().includes(term)));
    return sortCollectionRoots(matching, collectionSort);
  }, [collections, workspaceRequestLists, explorerSearch, collectionSort, selectedWs]);
  const visibleLocalCollections = useMemo(
    () => sortCollectionRoots(localCollections, collectionSort), [localCollections, collectionSort]);
  return {visibleCollections,visibleLocalCollections};
}
