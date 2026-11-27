import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,FolderClosed,Ellipsis,Plus} from 'lucide-react';
import {LocalCollectionBranch} from './LocalCollectionBranch.jsx';
import {filterCollectionTree,makeCollectionTree} from '../services/localCollections';
import {collectLocalExpansionKeys} from '../services/collectionExpansion';
import {MenuActionItem} from '../../../components/ui/MenuActionItem';
import {Dialog} from '../../../components/ui/WorkbenchPrimitives.jsx';
import {localFolderMoveTargets,localFolderPaths} from '../services/folderMoveTargets.js';
import {startFolderDrag,isFolderDrag,readFolderDrag,endFolderDrag} from '../services/folderDrag.js';
import {visibleCollectionNodes,collectionParentChain,startCollectionDrag,isCollectionDrag,readCollectionDrag,endCollectionDrag,collectionDropPosition} from '../services/collectionHierarchy.js';

import '../../../styles/features/collection-settings.css';

const menus={
  collection:[['newRequest','New request'],['organizeFolders','Move folder…'],['organizeCollection','Move collection…'],['runCollection','Run collection'],['variables','Variables'],['documentation','Documentation'],['renameCollection','Rename'],['duplicateCollection','Duplicate collection'],['sortCollection','Sort by name'],['sortMethod','Sort by method'],['exportCollection','Export collection'],['deleteCollection','Delete collection']],
  folder:[['newRequest','New request here'],['moveFolder','Move to…'],['documentation','Documentation'],['renameFolder','Rename folder'],['duplicateFolder','Duplicate folder'],['sortFolder','Sort folder'],['deleteFolder','Delete folder']],
  request:[['documentation','Documentation'],['renameRequest','Rename'],['duplicateRequest','Duplicate'],['deleteRequest','Delete']],
  example:[['renameExample','Rename example'],['deleteExample','Delete example']]
};
const DRAG_MIME='application/x-pakpost-local-request';
const FOLDER_DRAG_MIME='application/x-pakpost-local-folder';
const isLocalDrag=transfer=>isFolderDrag(transfer,FOLDER_DRAG_MIME)||Array.from(transfer?.types||[]).includes(DRAG_MIME);
function popupAt(event,setMenu,context){event.preventDefault();event.stopPropagation();
  const rect=event.currentTarget.getBoundingClientRect();
  const x=event.clientX||rect.right,y=event.clientY||rect.bottom;
  setMenu({...context,x:Math.min(x,window.innerWidth-245),y:Math.min(y,window.innerHeight-345)});
}
export function LocalCollectionsTree({collections,search='',onOpen,onOpenExample,onAction,onMove,onMoveFolder,onMoveCollection,onOrganizeCollection,collectionSort='manual',expandAllSignal,revealDraft,pendingTabs=[],onOpenPending=()=>{}}){
  const [expanded,setExpanded]=useState({}),[menu,setMenu]=useState(null),[dropTarget,setDropTarget]=useState('');
  const [moveDialog,setMoveDialog]=useState(null);
  const [dragging,setDragging]=useState(null);
  useEffect(()=>{
    const change=e=>setDragging(e.detail?.kind&&e.detail?.scope==='local'?e.detail:null);
    window.addEventListener('pakpost:explorer-drag',change);
    return()=>window.removeEventListener('pakpost:explorer-drag',change);
  },[]);
  // Only opened collections build trees. Reuse each immutable Local request
  // array's tree until it changes, instead of rebuilding on every UI keystroke.
  const treeCache = useRef(new WeakMap());
  const cachedTree = requests => {
    let tree = treeCache.current.get(requests);
    if (!tree) {
      tree = makeCollectionTree(requests);
      treeCache.current.set(requests,tree);
    }
    return tree;
  };
  const toggle=(key,defaultOpen=true)=>setExpanded(old=>({...old,[key]:!(old[key]??defaultOpen)}));
  useEffect(()=>{
    const reveal=event=>{const id=event.detail?.collectionId;
      if(id)setExpanded(old=>({...old,...Object.fromEntries(collectionParentChain(collections,id)
        .map(item=>[`collection:${item}`,true]))}));};
    window.addEventListener('pakpost:local-collection-reveal',reveal);
    return()=>window.removeEventListener('pakpost:local-collection-reveal',reveal);
  },[collections]);
  useEffect(()=>{
    if(!revealDraft)return;
    const {collectionId,folderPath=[]}=revealDraft;
    const keys=[...collectionParentChain(collections,collectionId).map(id=>`collection:${id}`),...folderPath.map((_,index)=>`${collectionId}:${JSON.stringify(folderPath.slice(0,index+1))}`)];
    setExpanded(old=>({...old,...Object.fromEntries(keys.map(key=>[key,true]))}));
  },[revealDraft,collections]);
  useEffect(()=>{
    if(!expandAllSignal)return;
    setExpanded(old=>({...old,...Object.fromEntries(collectLocalExpansionKeys(collections).map(key=>[key,expandAllSignal.open]))}));
  },[expandAllSignal]);
  const openMenu=(event,info)=>popupAt(event,setMenu,info);
  useEffect(()=>{if(!menu)return;const close=e=>{if(!e.target.closest?.('.pp-collection-popup'))setMenu(null)};
    const escape=e=>{if(e.key==='Escape')setMenu(null)};
    window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);
    return ()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape)};
  },[menu]);
  const drop=(e,targetCollectionId,targetFolderPath=[],beforeRequestId,placement='before')=>{
    const source=readFolderDrag(e.dataTransfer,FOLDER_DRAG_MIME);
    if(source){
      if(typeof source.collectionId==='string'&&Array.isArray(source.folderPath))
        onMoveFolder?.({...source,targetCollectionId,targetFolderPath});
      endFolderDrag();
      return;
    }
    try{
      const raw=e.dataTransfer.getData(DRAG_MIME);
      if(!raw)return;
      const data=JSON.parse(raw);
      if(data.requestId!==beforeRequestId)onMove({...data,targetCollectionId,targetFolderPath,beforeRequestId,placement});
    }catch{/* Ignore malformed drops from outside the workbench. */}
    finally{endFolderDrag();}
  };
  const collectionNodes=visibleCollectionNodes(collections,{sort:collectionSort,search,
    isOpen:col=>expanded[`collection:${col.id}`]!==false,
    requestMatches:col=>(col.requests||[]).some(r=>`${r.name||r.requestName} ${r.url||''}`.toLowerCase().includes(search.toLowerCase()))});
  const moveCollection=moveDialog?collections.find(c=>c.id===moveDialog.collectionId):null;
  const destinationCollection=moveDialog?collections.find(c=>c.id===moveDialog.targetCollectionId):null;
  const sourcePaths=moveDialog?localFolderPaths(moveCollection):[];
  const moveTargets=moveDialog&&moveDialog.folderPath?.length?
    (moveDialog.targetCollectionId===moveDialog.collectionId?
      localFolderMoveTargets(moveCollection,moveDialog.folderPath):
      [[],...localFolderPaths(destinationCollection)]):[];
  return <div className="pp-local-collections" aria-label="Local collections">
    {dragging&&<div className="pp-collection-root-zone" role="region" aria-label="Move collection or folder to Local root"
      onDragOver={e=>{if(isCollectionDrag(e.dataTransfer)||isFolderDrag(e.dataTransfer,FOLDER_DRAG_MIME)){
        e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';
      }}}
      onDrop={e=>{
        e.preventDefault();e.stopPropagation();
        const item=readCollectionDrag(e.dataTransfer);
        if(item?.scope==='local'){endCollectionDrag();onMoveCollection?.(item.collectionId,null,'root');return;}
        const folder=readFolderDrag(e.dataTransfer,FOLDER_DRAG_MIME);
        if(folder?.collectionId){onMoveFolder?.({...folder,targetCollectionId:folder.collectionId,targetFolderPath:[]});endFolderDrag();}
      }}>
      Drop a collection or folder here to move it to root
    </div>}
    {collectionNodes.map(({collection:col,depth})=>{
      const key=`collection:${col.id}`;const opened=!!search||expanded[key]!==false;
      // Closed Local collections keep their expansion state, not a hidden DOM subtree.
      const rawTree=opened?cachedTree(col.requests):null;
      const tree=rawTree&&(col.name.toLowerCase().includes(search.toLowerCase())?rawTree:filterCollectionTree(rawTree,search));
      return <div key={col.id} className="pp-local-collection" onDragOver={e=>{if(isLocalDrag(e.dataTransfer))e.preventDefault()}} onDrop={e=>{
        if(isCollectionDrag(e.dataTransfer))return;
        e.preventDefault();e.stopPropagation();setDropTarget('');drop(e,col.id,[]);
      }}>
        <div className={`pp-local-collection-head pp-tree-item-container ${dropTarget===key?'pp-folder-drop-target':''} ${dropTarget.startsWith(`${key}:`)?'pp-collection-drop-target':''} ${dropTarget===`${key}:before`?'pp-collection-drop-before':''} ${dropTarget===`${key}:after`?'pp-collection-drop-after':''}`} style={{'--pp-tree-depth':depth}}
          draggable onDragStart={e=>{e.stopPropagation();startCollectionDrag(e.dataTransfer,{scope:'local',collectionId:col.id});}}
          onDragEnd={()=>{endCollectionDrag();setDropTarget('');}}
          onDragOver={e=>{if(isCollectionDrag(e.dataTransfer)){
            e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setDropTarget(`${key}:${collectionDropPosition(e)}`);
          }else if(isLocalDrag(e.dataTransfer)){e.preventDefault();e.stopPropagation();setDropTarget(key);}}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget('');}}
          onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');
            const data=readCollectionDrag(e.dataTransfer);
            if(data){endCollectionDrag();if(data.scope==='local')onMoveCollection?.(data.collectionId,col.id,collectionDropPosition(e));return;}
            drop(e,col.id,[]);
          }}>
          <button type="button" draggable onDragStart={e=>{e.stopPropagation();startCollectionDrag(e.dataTransfer,{scope:'local',collectionId:col.id});}}
            className="pp-tree-row pp-explorer-tree-row" onClick={e=>{if(e.target.closest?.('[data-collection-disclosure]'))toggle(key);else onAction({action:'variables',collectionId:col.id,name:col.name});}} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();if((e.key==='ArrowRight')!==!!opened)toggle(key);}}} title={`${col.name} · Collection settings`} aria-expanded={opened} onContextMenu={e=>openMenu(e,{type:'collection',collectionId:col.id,name:col.name})}>
            <span data-collection-disclosure className="pp-collection-disclosure" aria-hidden="true" title={opened?'Collapse collection':'Expand collection'}>{opened?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</span><FolderClosed size={15}/><span>{col.name}</span><small>{col.requests.length}</small>
          </button>
          <div className="pp-tree-actions">
            <button className="pp-tree-action" type="button" title="New request in collection" aria-label={`New request in ${col.name}`} onClick={()=>onAction({action:'newRequest',collectionId:col.id,folderPath:[]})}><Plus size={15}/></button>
            <button className="pp-tree-action" type="button" aria-label={`Actions for collection ${col.name}`} onClick={e=>openMenu(e,{type:'collection',collectionId:col.id,name:col.name})}><Ellipsis size={15}/></button>
          </div>
        </div>
        <div className={`pp-collection-motion ${opened?'is-open':''}`} aria-hidden={!opened} inert={!opened}>
          <div className="pp-collection-motion-inner">{opened&&tree&&<LocalCollectionBranch node={tree} collectionId={col.id} depth={depth} search={search} onOpen={onOpen} onOpenExample={onOpenExample} onMenu={openMenu} expanded={expanded} toggle={toggle} onMove={drop} pendingTabs={pendingTabs} onOpenPending={onOpenPending} dropTarget={dropTarget} setDropTarget={setDropTarget}/>}</div>
        </div>
      </div>;
    })}
    {moveDialog&&createPortal(<Dialog title="Move Local folder" subtitle="Move a folder and all nested requests/documentation to any Local collection." onClose={()=>setMoveDialog(null)}>
      <form className="pp-folder-move-form" onSubmit={e=>{
        e.preventDefault();
        if(!moveDialog.folderPath.length)return;
        onMoveFolder?.({collectionId:moveDialog.collectionId,folderPath:moveDialog.folderPath,
          targetCollectionId:moveDialog.targetCollectionId,targetFolderPath:moveDialog.targetFolderPath});
        setMoveDialog(null);
      }}>
        <label htmlFor="pp-local-folder-move-source">Folder to move</label>
        <select id="pp-local-folder-move-source" autoFocus value={JSON.stringify(moveDialog.folderPath)}
          onChange={e=>setMoveDialog(old=>({...old,folderPath:JSON.parse(e.target.value),targetFolderPath:[]}))}>
          <option value="[]">Select a folder…</option>
          {sourcePaths.map(path=><option key={JSON.stringify(path)} value={JSON.stringify(path)}>{path.join(' / ')}</option>)}
        </select>
        {!sourcePaths.length&&<p className="pp-folder-move-note">This collection has no folders yet. Create a folder first.</p>}
        <label htmlFor="pp-local-folder-move-collection">Destination collection</label>
        <select id="pp-local-folder-move-collection" value={moveDialog.targetCollectionId}
          onChange={e=>setMoveDialog(old=>({...old,targetCollectionId:e.target.value,targetFolderPath:[]}))}>
          {collections.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}
        </select>
        <label htmlFor="pp-local-folder-move-target">Destination folder</label>
        <select id="pp-local-folder-move-target" disabled={!moveDialog.folderPath.length} value={JSON.stringify(moveDialog.targetFolderPath)}
          onChange={e=>setMoveDialog(old=>({...old,targetFolderPath:JSON.parse(e.target.value)}))}>
          {moveTargets.map(path=><option key={JSON.stringify(path)} value={JSON.stringify(path)}>{path.length?path.join(' / '):'Collection root'}</option>)}
        </select>
        <div className="pp-action-dialog-buttons"><button type="button" onClick={()=>setMoveDialog(null)}>Cancel</button>
          <button type="submit" disabled={!moveDialog.folderPath.length} className="pp-modal-submit">Move folder</button></div>
      </form>
    </Dialog>,document.body)}
    {menu&&createPortal(<div role="menu" className="pp-collection-popup" style={{left:Math.max(8,menu.x),top:Math.max(8,menu.y)}}>
      {menus[menu.type].map(([action,label])=><MenuActionItem key={action} action={action} danger={action.startsWith('delete')} onClick={()=>{if(action==='organizeCollection'){onOrganizeCollection?.(menu.collectionId);}else if(action==='moveFolder'||action==='organizeFolders'){setMoveDialog({collectionId:menu.collectionId,targetCollectionId:menu.collectionId,folderPath:action==='moveFolder'?menu.folderPath:[],targetFolderPath:[]});}else onAction({...menu,action});setMenu(null);}}>{label}</MenuActionItem>)}
    </div>,document.body)}
  </div>;
}
