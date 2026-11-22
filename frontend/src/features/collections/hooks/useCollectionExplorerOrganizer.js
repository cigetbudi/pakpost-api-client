import {useEffect,useMemo,useState} from 'react';
import {collectionParentChain,arrangeCollections,visibleCollectionNodes} from '../services/collectionHierarchy.js';
import {isWorkspaceCollectionOpen,workspaceCollectionKey} from '../services/collectionExpansion.js';

/** Organizing and drag indicators are scoped to the mounted Explorer panel. */
export function useCollectionExplorerOrganizer({
  selectedWs,collectionSort,setCollectionSort,collections,localCollections,
  explorerSearch,expandedCollections,selectedCol,workspaceRequestLists,
  canEditCloud,setExpandedCollections,moveLocalCollection,moveWorkspaceCollection
}) {
  const [collectionOrganizer,setCollectionOrganizer]=useState(null);
  const [organizeDestination,setOrganizeDestination]=useState('root:');
  const [collectionDropTarget,setCollectionDropTarget]=useState('');
  const [requestDropTarget,setRequestDropTarget]=useState('');
  const [dragging,setDragging]=useState(null);
  useEffect(()=>{
    const listener=e=>setDragging(e.detail?.kind&&e.detail?.scope==='workspace'&&
      e.detail.workspaceId===selectedWs?e.detail:null);
    window.addEventListener('pakpost:explorer-drag',listener);
    return()=>window.removeEventListener('pakpost:explorer-drag',listener);
  },[selectedWs]);
  useEffect(()=>{
    const open=event=>{
      const detail=event.detail;
      if(detail?.scope==='workspace'&&detail.workspaceId===selectedWs){
        setCollectionOrganizer({scope:'workspace',sourceId:detail.collectionId});
        setOrganizeDestination('root:');
      }
    };
    window.addEventListener('pakpost:collection-organizer',open);
    return()=>window.removeEventListener('pakpost:collection-organizer',open);
  },[selectedWs]);
  const localMove=(source,target,placement)=>{setCollectionSort('manual');if(placement==='inside'&&target)window.dispatchEvent(new CustomEvent('pakpost:local-collection-reveal',{detail:{collectionId:target}}));moveLocalCollection(source,target,placement);};
  const cloudMove=(source,target,placement)=>{
    if(!canEditCloud)return;
    setCollectionSort('manual');
    if(placement==='inside'&&target)setExpandedCollections(old=>({...old,...Object.fromEntries(
      collectionParentChain(collections,target).map(id=>[workspaceCollectionKey(selectedWs,id),true]))}));
    moveWorkspaceCollection(source,target,placement);
  };
  const cloudNodes=useMemo(()=>visibleCollectionNodes(collections,{sort:collectionSort,search:explorerSearch,
    isOpen:col=>isWorkspaceCollectionOpen(expandedCollections,selectedWs,col.id,selectedCol),
    requestMatches:col=>(workspaceRequestLists[workspaceCollectionKey(selectedWs,col.id)]||[]).some(request=>
      `${request.name||''} ${request.url||''}`.toLowerCase().includes(explorerSearch.toLowerCase()))}),
    [collections,collectionSort,explorerSearch,expandedCollections,selectedWs,selectedCol,workspaceRequestLists]);
  const organizationList=collectionOrganizer?.scope==='local'?localCollections:collections;
  const chosen=organizationList.find(item=>item.id===collectionOrganizer?.sourceId);
  const organizationOptions=chosen?[{value:'root:',label:'Collection root (last)'},
    ...organizationList.flatMap(item=>['inside','before','after'].flatMap(placement=>{
      try{arrangeCollections(organizationList,chosen.id,item.id,placement);}
      catch{return [];}
      return [{value:`${placement}:${item.id}`,label:`${placement==='inside'?'Inside':placement==='before'?'Before':'After'} ${item.name}`}];
    }))]:[];
  const organize=async()=>{
    if(!chosen)return;
    const [placement,target]=organizeDestination.split(':');
    if(collectionOrganizer.scope==='local')localMove(chosen.id,target||null,placement);
    else cloudMove(chosen.id,target||null,placement);
    setCollectionOrganizer(null);
  };
  return {
    collectionOrganizer,setCollectionOrganizer,organizeDestination,setOrganizeDestination,
    collectionDropTarget,setCollectionDropTarget,requestDropTarget,setRequestDropTarget,
    dragging,setDragging,localMove,cloudMove,cloudNodes,organizationList,chosen,
    organizationOptions,organize,
  };
}
