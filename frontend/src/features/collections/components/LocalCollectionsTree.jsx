import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,FolderClosed,Ellipsis,GripVertical,Plus} from 'lucide-react';
import {filterCollectionTree,makeCollectionTree} from '../services/localCollections';
import {collectLocalExpansionKeys} from '../services/collectionExpansion';
import {MenuActionItem} from '../../../components/ui/MenuActionItem';
import {statusTone} from '../../requests/services/responseExamples.js';

const menus={
  collection:[['newRequest','New request'],['runCollection','Run collection'],['variables','Variables'],['documentation','Documentation'],['renameCollection','Rename'],['duplicateCollection','Duplicate collection'],['sortCollection','Sort by name'],['sortMethod','Sort by method'],['exportCollection','Export collection'],['deleteCollection','Delete collection']],
  folder:[['newRequest','New request here'],['documentation','Documentation'],['renameFolder','Rename folder'],['duplicateFolder','Duplicate folder'],['sortFolder','Sort folder'],['deleteFolder','Delete folder']],
  request:[['documentation','Documentation'],['renameRequest','Rename'],['duplicateRequest','Duplicate'],['deleteRequest','Delete']],
  example:[['renameExample','Rename example'],['deleteExample','Delete example']]
};
const DRAG_MIME='application/x-pakpost-local-request';
function popupAt(event,setMenu,context){event.preventDefault();event.stopPropagation();
  const rect=event.currentTarget.getBoundingClientRect();
  const x=event.clientX||rect.right,y=event.clientY||rect.bottom;
  setMenu({...context,x:Math.min(x,window.innerWidth-245),y:Math.min(y,window.innerHeight-345)});
}
function Branch({node,collectionId,path=[],depth=0,search,onOpen,onOpenExample,onMenu,expanded,toggle,onMove,pendingTabs,onOpenPending}){
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
        <div className={`pp-collection-motion ${opened?'is-open':''}`} aria-hidden={!opened} inert={!opened}>
          <div className="pp-collection-motion-inner"><Branch node={folder} collectionId={collectionId} path={folderPath} depth={depth+1} search={search} onOpen={onOpen} onOpenExample={onOpenExample} onMenu={onMenu} expanded={expanded} toggle={toggle} onMove={onMove} pendingTabs={pendingTabs} onOpenPending={onOpenPending}/></div>
        </div>
      </React.Fragment>;
    })}
    {(pendingTabs||[]).filter(t=>t.source?.collectionId===collectionId && JSON.stringify(t.source?.folderPath||[])===JSON.stringify(path) && (!search||t.name.toLowerCase().includes(search.toLowerCase()))).map(t=>
      <button key={t.id} type="button" className="pp-tree-request pp-draft-request" style={{paddingLeft:32+depth*14}} title="Unsaved draft — click to edit" onClick={()=>onOpenPending(t.id)}>
        <span className={`pp-http-label ${(t.method||'GET').toLowerCase()}`}>{t.method||'GET'}</span><span>{t.name}</span><span className="pp-unsaved-dot" title="Not saved"/>
      </button>)}
    {node.requests.map(r=>{
      const term=String(search||'').trim().toLowerCase();
      const requestLabel=String(r.requestName||r.name||'').toLowerCase();
      const examples=(r.responseExamples||[]).filter(example=>!term||requestLabel.includes(term)||`${example.name} ${example.statusCode} ${example.reasonPhrase||''}`.toLowerCase().includes(term));
      const exampleKey=`examples:${collectionId}:${r.id}`;
      const examplesOpen=expanded[exampleKey]??!!search;
      return <React.Fragment key={r.id}>
        <div className="pp-tree-item-container" draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData(DRAG_MIME,JSON.stringify({collectionId,requestId:r.id}));}} onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(DRAG_MIME))e.preventDefault()}} onDrop={e=>{e.preventDefault();e.stopPropagation();onMove(e,collectionId,path,r.id)}}>
          {!!examples.length&&<button type="button" className="pp-endpoint-example-toggle pp-local-example-toggle" style={{left:12+depth*14}} aria-expanded={examplesOpen} aria-label={`${examplesOpen?'Collapse':'Expand'} ${examples.length} examples for ${r.requestName||r.name}`} title={`${examplesOpen?'Hide':'Show'} ${examples.length} response examples`} onClick={e=>{e.stopPropagation();toggle(exampleKey,!!search);}}>{examplesOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>}
          <button type="button" className="pp-tree-request pp-local-request" style={{paddingLeft:12+depth*14}} title={r.url} onClick={()=>onOpen(r,collectionId)} onContextMenu={e=>onMenu(e,{type:'request',collectionId,requestId:r.id,name:r.requestName||r.name})}>
            {examples.length?<span className="pp-endpoint-chevron-slot"/>:<GripVertical className="pp-drag-grip" size={12}/>}<span className={`pp-http-label ${(r.method||'GET').toLowerCase()}`}>{r.method||'GET'}</span><span>{r.requestName||r.name}</span>
          </button>
          <button type="button" className="pp-tree-action" aria-label={`Actions for request ${r.requestName||r.name}`} onClick={e=>onMenu(e,{type:'request',collectionId,requestId:r.id,name:r.requestName||r.name})}><Ellipsis size={15}/></button>
        </div>
        {!!examples.length&&<div className={`pp-collection-motion pp-example-motion ${examplesOpen?'is-open':''}`} aria-hidden={!examplesOpen} inert={!examplesOpen}><div className="pp-collection-motion-inner">{examples.map(example=><div className="pp-tree-item-container" key={`${r.id}:${example.id}`}>
          <button type="button" className="pp-tree-example" style={{paddingLeft:58+depth*14}} onClick={()=>onOpenExample(r,collectionId,example)} onContextMenu={e=>onMenu(e,{type:'example',collectionId,requestId:r.id,exampleId:example.id,name:example.name})} title={example.description||example.name}>
            <span className={`pp-example-status ${statusTone(example.statusCode)}`}>{example.statusCode}</span><span>{example.name}</span>
          </button>
          <button type="button" className="pp-tree-action" aria-label={`Actions for example ${example.name}`} onClick={e=>onMenu(e,{type:'example',collectionId,requestId:r.id,exampleId:example.id,name:example.name})}><Ellipsis size={15}/></button>
        </div>)}</div></div>}
      </React.Fragment>;
    })}
  </>;
}
export function LocalCollectionsTree({collections,search='',onOpen,onOpenExample,onAction,onMove,expandAllSignal,revealDraft,pendingTabs=[],onOpenPending=()=>{}}){
  const [expanded,setExpanded]=useState({}),[menu,setMenu]=useState(null);
  const toggle=(key,defaultOpen=true)=>setExpanded(old=>({...old,[key]:!(old[key]??defaultOpen)}));
  useEffect(()=>{
    if(!revealDraft)return;
    const {collectionId,folderPath=[]}=revealDraft;
    const keys=[`collection:${collectionId}`,...folderPath.map((_,index)=>`${collectionId}:${JSON.stringify(folderPath.slice(0,index+1))}`)];
    setExpanded(old=>({...old,...Object.fromEntries(keys.map(key=>[key,true]))}));
  },[revealDraft]);
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
  const drop=(e,targetCollectionId,targetFolderPath=[],beforeRequestId)=>{
    try{const data=JSON.parse(e.dataTransfer.getData(DRAG_MIME));if(data.requestId!==beforeRequestId)onMove({...data,targetCollectionId,targetFolderPath,beforeRequestId});}catch{}
  };
  return <div className="pp-local-collections" aria-label="Local collections">
    {collections.map(col=>{
      const tree=col.name.toLowerCase().includes(search.toLowerCase())?makeCollectionTree(col.requests):filterCollectionTree(makeCollectionTree(col.requests),search);
      if(search&&!tree.requests.length&&!tree.folders.length&&!col.name.toLowerCase().includes(search.toLowerCase())
        &&!pendingTabs.some(t=>t.source?.collectionId===col.id && t.name.toLowerCase().includes(search.toLowerCase())))return null;
      const key=`collection:${col.id}`;const opened=!!search||expanded[key]!==false;
      return <div key={col.id} className="pp-local-collection" onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(DRAG_MIME))e.preventDefault()}} onDrop={e=>{e.preventDefault();e.stopPropagation();drop(e,col.id,[])}}>
        <div className="pp-local-collection-head pp-tree-item-container">
          <button type="button" className="pp-tree-row" onClick={()=>toggle(key)} title={col.name} aria-expanded={opened} onContextMenu={e=>openMenu(e,{type:'collection',collectionId:col.id,name:col.name})}>
            {opened?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<FolderClosed size={15}/><span>{col.name}</span><small>{col.requests.length}</small>
          </button>
          <div className="pp-tree-actions">
            <button className="pp-tree-action" type="button" title="New request in collection" aria-label={`New request in ${col.name}`} onClick={()=>onAction({action:'newRequest',collectionId:col.id,folderPath:[]})}><Plus size={15}/></button>
            <button className="pp-tree-action" type="button" aria-label={`Actions for collection ${col.name}`} onClick={e=>openMenu(e,{type:'collection',collectionId:col.id,name:col.name})}><Ellipsis size={15}/></button>
          </div>
        </div>
        <div className={`pp-collection-motion ${opened?'is-open':''}`} aria-hidden={!opened} inert={!opened}>
          <div className="pp-collection-motion-inner"><Branch node={tree} collectionId={col.id} search={search} onOpen={onOpen} onOpenExample={onOpenExample} onMenu={openMenu} expanded={expanded} toggle={toggle} onMove={drop} pendingTabs={pendingTabs} onOpenPending={onOpenPending}/></div>
        </div>
      </div>;
    })}
    {menu&&createPortal(<div role="menu" className="pp-collection-popup" style={{left:Math.max(8,menu.x),top:Math.max(8,menu.y)}}>
      {menus[menu.type].map(([action,label])=><MenuActionItem key={action} action={action} danger={action.startsWith('delete')} onClick={()=>{onAction({...menu,action});setMenu(null);}}>{label}</MenuActionItem>)}
    </div>,document.body)}
  </div>;
}
