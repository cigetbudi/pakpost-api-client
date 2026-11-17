import { useEffect } from 'react';
import { writeLocalCollections } from '../../features/collections/services/localCollections.js';
import { writeWorkspaceCollectionDocs } from '../../features/collections/services/documentationStore.js';

export function useWorkbenchPreferencesPersistence({localCollections,workspaceCollectionDocs,collectionSort,rightWidth}) {
  useEffect(()=>writeLocalCollections(localCollections),[localCollections]);
  useEffect(()=>writeWorkspaceCollectionDocs(localStorage,workspaceCollectionDocs),[workspaceCollectionDocs]);
  useEffect(()=>{localStorage.setItem('pakpost_v14_global_collection_sort',collectionSort)},[collectionSort]);
  useEffect(()=>{localStorage.setItem('pakpost_v14_right_width',String(rightWidth))},[rightWidth]);
}
