import { useEffect } from 'react';
import { writeLocalCollections } from '../../features/collections/services/localCollections.js';
import { isTauriDesktop, saveDesktopCollections } from '../../features/collections/services/desktopLocalRepository.js';
import { useRef } from 'react';
import { writeWorkspaceCollectionDocs } from '../../features/collections/services/documentationStore.js';

export function useWorkbenchPreferencesPersistence({localCollections,workspaceCollectionDocs,collectionSort,rightWidth,desktopLocalReady=true}) {
  const pendingSave = useRef(Promise.resolve());
  useEffect(()=>{
    if(!desktopLocalReady)return;
    if(!isTauriDesktop()){writeLocalCollections(localCollections);return;}
    // Sequential writes guarantee that an older async save cannot win a race.
    pendingSave.current=pendingSave.current.catch(()=>{}).then(()=>saveDesktopCollections(localCollections));
    pendingSave.current.catch(err=>console.error('Failed saving desktop collections:',err));
  },[localCollections,desktopLocalReady]);
  useEffect(()=>writeWorkspaceCollectionDocs(localStorage,workspaceCollectionDocs),[workspaceCollectionDocs]);
  useEffect(()=>{localStorage.setItem('pakpost_v14_global_collection_sort',collectionSort)},[collectionSort]);
  useEffect(()=>{localStorage.setItem('pakpost_v14_right_width',String(rightWidth))},[rightWidth]);
}
