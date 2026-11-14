import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,FolderClosed,Ellipsis,GripVertical} from 'lucide-react';
import {filterCollectionTree,makeCollectionTree} from './localCollections';

const menus={
  collection:[['newRequest','New request'],['renameCollection','Rename'],['duplicateCollection','Duplicate collection'],['sortCollection','Sort by name'],['sortMethod','Sort by method'],['exportCollection','Export collection'],['deleteCollection','Delete collection']],
  folder:[['newRequest','New request here'],['renameFolder','Rename folder'],['duplicateFolder','Duplicate folder'],['sortFolder','Sort folder'],['deleteFolder','Delete folder']],
  request:[['renameRequest','Rename'],['duplicateRequest','Duplicate'],['deleteRequest','Delete']]
};
const DRAG_MIME='application/x-pakpost-local-request';
function popupAt(event,setMenu,context){event.preventDefault();event.stopPropagation();
  const rect=event.currentTarget.getBoundingClientRect();
  const x=event.clientX||rect.right,y=event.clientY||rect.bottom;
  setMenu({...context,x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-270)});
}
function Branch({node,collectionId,path=[],depth=0,search,onOpen,onMenu,expanded,toggle,onMove}){
  return <>
    {node.folders.map(folder=>{
      const folderPath=[...path,folder.name];const key=`${collectionId}:${JSON.stringify(folderPath)}`;
      const opened=search||expanded[key]!==false;
      return <React.Fragment key={key}>
        <div className="pp-tree-item-container" onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(DRAG_MIME))e.preventDefault()}} onDrop={e=>{e.preventDefault();e.stopPropagation();onMove(e,collectionId,folderPath)}}>
          <button type="button" className="pp-tree-row pp-local-folder" style={{paddingLeft:17+depth*14}} onClick={()=>toggle(key)} onContextMenu={e=>onMenu(e,{type:'folder',collectionId,folderPath,name:folder.name})} title={folderPath.join(' / ')}>
            {opened?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<FolderClosed size={14}/><span>{folder.name}</span>
          </button>
          <button type="button" className="pp-tree-action" aria-label={`Actions for folder ${folder.name}`} onClick={e=>onMenu(e,{type:'folder',collectionId,folderPath,name:folder.name})}><Ellipsis size={15}/></button>
        </div>
        {opened&&<Branch node={folder} collectionId={collectionId} path={folderPath} depth={depth+1} search={search} onOpen={onOpen} onMenu={onMenu} expanded={expanded} toggle={toggle} onMove={onMove}/>}
      </React.Fragment>;
    })}
    {node.requests.map(r=><div className="pp-tree-item-container" key={r.id} draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData(DRAG_MIME,JSON.stringify({collectionId,requestId:r.id}));}} onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(DRAG_MIME))e.preventDefault()}} onDrop={e=>{e.preventDefault();e.stopPropagation();onMove(e,collectionId,path,r.id)}}>
      <button type="button" className="pp-tree-request pp-local-request" style={{paddingLeft:26+(depth*14)}} title={r.url} onClick={()=>onOpen(r,collectionId)} onContextMenu={e=>onMenu(e,{type:'request',collectionId,requestId:r.id,name:r.requestName||r.name})}>
        <GripVertical className="pp-drag-grip" size={12}/><span className={`pp-http-label ${(r.method||'GET').toLowerCase()}`}>{r.method||'GET'}</span><span>{r.requestName||r.name}</span>
      </button>
      <button type="button" className="pp-tree-action" aria-label={`Actions for request ${r.requestName||r.name}`} onClick={e=>onMenu(e,{type:'request',collectionId,requestId:r.id,name:r.requestName||r.name})}><Ellipsis size={15}/></button>
    </div>)}
  </>;
}
export function LocalCollectionsTree({collections,search='',onOpen,onAction,onMove}){
  const [expanded,setExpanded]=useState({}),[menu,setMenu]=useState(null);
  const toggle=key=>setExpanded(old=>({...old,[key]:old[key]===false?true:false}));
  const openMenu=(event,info)=>popupAt(event,setMenu,info);
  useEffect(()=>{if(!menu)return;const close=e=>{if(!e.target.closest?.('.pp-collection-popup'))setMenu(null)};
    const escape=e=>{if(e.key==='Escape')setMenu(null)};
    window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);
    return ()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape)};
  },[menu]);
  const drop=(e,targetCollectionId,targetFolderPath=[],beforeRequestId)=>{
    try{const data=JSON.parse(e.dataTransfer.getData(DRAG_MIME));if(data.requestId!==beforeRequestId)onMove({...data,targetCollectionId,targetFolderPath,beforeRequestId});}catch{}
  };
  return <div className="pp-local-collections" aria-label="Local collections">
    {collections.map(col=>{
      const tree=col.name.toLowerCase().includes(search.toLowerCase())?makeCollectionTree(col.requests):filterCollectionTree(makeCollectionTree(col.requests),search);
      if(search&&!tree.requests.length&&!tree.folders.length&&!col.name.toLowerCase().includes(search.toLowerCase()))return null;
      const key=`collection:${col.id}`;const opened=!!search||expanded[key]!==false;
      return <div key={col.id} className="pp-local-collection" onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(DRAG_MIME))e.preventDefault()}} onDrop={e=>{e.preventDefault();e.stopPropagation();drop(e,col.id,[])}}>
        <div className="pp-local-collection-head pp-tree-item-container">
          <button type="button" className="pp-tree-row" onClick={()=>toggle(key)} title={col.name} aria-expanded={opened} onContextMenu={e=>openMenu(e,{type:'collection',collectionId:col.id,name:col.name})}>
            {opened?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<FolderClosed size={15}/><span>{col.name}</span><small>{col.requests.length}</small>
          </button>
          <button className="pp-tree-action" type="button" aria-label={`Actions for collection ${col.name}`} onClick={e=>openMenu(e,{type:'collection',collectionId:col.id,name:col.name})}><Ellipsis size={15}/></button>
        </div>
        {opened&&<Branch node={tree} collectionId={col.id} search={search} onOpen={onOpen} onMenu={openMenu} expanded={expanded} toggle={toggle} onMove={drop}/>}
      </div>;
    })}
    {menu&&createPortal(<div role="menu" className="pp-collection-popup" style={{left:Math.max(8,menu.x),top:Math.max(8,menu.y)}}>
      {menus[menu.type].map(([action,label])=><button type="button" role="menuitem" key={action} className={action.startsWith('delete')?'danger':''} onClick={()=>{onAction({...menu,action});setMenu(null);}}>{label}</button>)}
    </div>,document.body)}
  </div>;
}
