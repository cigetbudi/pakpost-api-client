import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronRight,FolderClosed,Ellipsis,Plus} from 'lucide-react';
import {filterCollectionTree,makeCollectionTree} from '../services/localCollections';
import {collectLocalExpansionKeys} from '../services/collectionExpansion';
import {MenuActionItem} from '../../../components/ui/MenuActionItem';
import {statusTone} from '../../requests/services/responseExamples.js';
import {Dialog} from '../../../components/ui/WorkbenchPrimitives.jsx';
import {localFolderMoveTargets,localFolderPaths} from '../services/folderMoveTargets.js';
import {startFolderDrag,isFolderDrag,readFolderDrag,endFolderDrag} from '../services/folderDrag.js';

const menus={
  collection:[['newRequest','New request'],['organizeFolders','Move folder…'],['runCollection','Run collection'],['variables','Variables'],['documentation','Documentation'],['renameCollection','Rename'],['duplicateCollection','Duplicate collection'],['sortCollection','Sort by name'],['sortMethod','Sort by method'],['exportCollection','Export collection'],['deleteCollection','Delete collection']],
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
function Branch({node,collectionId,path=[],depth=0,search,onOpen,onOpenExample,onMenu,expanded,toggle,onMove,pendingTabs,onOpenPending,dropTarget,setDropTarget}){
  return <>
    {node.folders.map(folder=>{
      const folderPath=[...path,folder.name];const key=`${collectionId}:${JSON.stringify(folderPath)}`;
      const opened=search||expanded[key]!==false;
      return <React.Fragment key={key}>
        <div className={`pp-tree-item-container ${dropTarget===key?'pp-folder-drop-target':''}`} style={{'--pp-tree-depth':depth+1}}
          draggable onDragStart={e=>{e.stopPropagation();startFolderDrag(e.dataTransfer,FOLDER_DRAG_MIME,{collectionId,folderPath});}}
          onDragEnd={()=>{endFolderDrag();setDropTarget('');}}
          onDragOver={e=>{if(isLocalDrag(e.dataTransfer)){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setDropTarget(key);}}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget('');}}
          onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');onMove(e,collectionId,folderPath);endFolderDrag();}}>
          <button type="button" draggable className="pp-tree-row pp-local-folder pp-explorer-tree-row"
            onDragStart={e=>{e.stopPropagation();startFolderDrag(e.dataTransfer,FOLDER_DRAG_MIME,{collectionId,folderPath});}}
            onDragOver={e=>{if(isLocalDrag(e.dataTransfer)){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setDropTarget(key);}}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');onMove(e,collectionId,folderPath);endFolderDrag();}}
            onClick={()=>toggle(key)} onContextMenu={e=>onMenu(e,{type:'folder',collectionId,folderPath,name:folder.name})} title={folderPath.join(' / ')}>
            {opened?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<FolderClosed size={14}/><span>{folder.name}</span>
          </button>
          <button type="button" className="pp-tree-action" aria-label={`Actions for folder ${folder.name}`} onClick={e=>onMenu(e,{type:'folder',collectionId,folderPath,name:folder.name})}><Ellipsis size={15}/></button>
        </div>
        <div className={`pp-collection-motion ${opened?'is-open':''}`} aria-hidden={!opened} inert={!opened}>
          <div className="pp-collection-motion-inner">{opened&&<Branch node={folder} collectionId={collectionId} path={folderPath} depth={depth+1} search={search} onOpen={onOpen} onOpenExample={onOpenExample} onMenu={onMenu} expanded={expanded} toggle={toggle} onMove={onMove} pendingTabs={pendingTabs} onOpenPending={onOpenPending} dropTarget={dropTarget} setDropTarget={setDropTarget}/>}</div>
        </div>
      </React.Fragment>;
    })}
    {(pendingTabs||[]).filter(t=>t.source?.collectionId===collectionId && JSON.stringify(t.source?.folderPath||[])===JSON.stringify(path) && (!search||t.name.toLowerCase().includes(search.toLowerCase()))).map(t=>
      <button key={t.id} type="button" className="pp-tree-request pp-draft-request pp-explorer-tree-request" style={{'--pp-tree-depth':depth+1}} title="Unsaved draft — click to edit" onClick={()=>onOpenPending(t.id)}>
        <span className="pp-tree-disclosure-slot" aria-hidden="true"/><span className={`pp-http-label ${(t.method||'GET').toLowerCase()}`}>{t.method||'GET'}</span><span className="pp-tree-name">{t.name}</span><span className="pp-unsaved-dot" title="Not saved"/>
      </button>)}
    {node.requests.map(r=>{
      const term=String(search||'').trim().toLowerCase();
      const requestLabel=String(r.requestName||r.name||'').toLowerCase();
      const examples=(r.responseExamples||[]).filter(example=>!term||requestLabel.includes(term)||`${example.name} ${example.statusCode} ${example.reasonPhrase||''}`.toLowerCase().includes(term));
      const exampleKey=`examples:${collectionId}:${r.id}`;
      const examplesOpen=expanded[exampleKey]??!!search;
      return <React.Fragment key={r.id}>
        <div className="pp-tree-item-container" style={{'--pp-tree-depth':depth+1}} draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData(DRAG_MIME,JSON.stringify({collectionId,requestId:r.id}));}} onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(DRAG_MIME))e.preventDefault()}} onDrop={e=>{e.preventDefault();e.stopPropagation();onMove(e,collectionId,path,r.id)}}>
          {!!examples.length&&<button type="button" className="pp-endpoint-example-toggle pp-local-example-toggle" aria-expanded={examplesOpen} aria-label={`${examplesOpen?'Collapse':'Expand'} ${examples.length} examples for ${r.requestName||r.name}`} title={`${examplesOpen?'Hide':'Show'} ${examples.length} response examples`} onClick={e=>{e.stopPropagation();toggle(exampleKey,!!search);}}>{examplesOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>}
          <button type="button" className="pp-tree-request pp-local-request pp-explorer-tree-request" title={r.url} onClick={()=>onOpen(r,collectionId)} onContextMenu={e=>onMenu(e,{type:'request',collectionId,requestId:r.id,name:r.requestName||r.name})}>
            <span className="pp-tree-disclosure-slot" aria-hidden="true"/><span className={`pp-http-label ${(r.method||'GET').toLowerCase()}`}>{r.method||'GET'}</span><span className="pp-tree-name">{r.requestName||r.name}</span>
          </button>
          <button type="button" className="pp-tree-action" aria-label={`Actions for request ${r.requestName||r.name}`} onClick={e=>onMenu(e,{type:'request',collectionId,requestId:r.id,name:r.requestName||r.name})}><Ellipsis size={15}/></button>
        </div>
        {!!examples.length&&<div className={`pp-collection-motion pp-example-motion ${examplesOpen?'is-open':''}`} aria-hidden={!examplesOpen} inert={!examplesOpen}><div className="pp-collection-motion-inner">{examplesOpen&&examples.map(example=><div className="pp-tree-item-container" key={`${r.id}:${example.id}`} style={{'--pp-tree-depth':depth+2}}>
          <button type="button" className="pp-tree-example pp-explorer-tree-example" onClick={()=>onOpenExample(r,collectionId,example)} onContextMenu={e=>onMenu(e,{type:'example',collectionId,requestId:r.id,exampleId:example.id,name:example.name})} title={example.description||example.name}>
            <span className="pp-tree-disclosure-slot" aria-hidden="true"/><span className={`pp-example-status ${statusTone(example.statusCode)}`}>{example.statusCode}</span><span className="pp-tree-name">{example.name}</span>
          </button>
          <button type="button" className="pp-tree-action" aria-label={`Actions for example ${example.name}`} onClick={e=>onMenu(e,{type:'example',collectionId,requestId:r.id,exampleId:example.id,name:example.name})}><Ellipsis size={15}/></button>
        </div>)}</div></div>}
      </React.Fragment>;
    })}
  </>;
}
export function LocalCollectionsTree({collections,search='',onOpen,onOpenExample,onAction,onMove,onMoveFolder,expandAllSignal,revealDraft,pendingTabs=[],onOpenPending=()=>{}}){
  const [expanded,setExpanded]=useState({}),[menu,setMenu]=useState(null),[dropTarget,setDropTarget]=useState('');
  const [moveDialog,setMoveDialog]=useState(null);
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
      if(data.requestId!==beforeRequestId)onMove({...data,targetCollectionId,targetFolderPath,beforeRequestId});
    }catch{/* Ignore malformed drops from outside the workbench. */}
    finally{endFolderDrag();}
  };
  const moveCollection=moveDialog?collections.find(c=>c.id===moveDialog.collectionId):null;
  const sourcePaths=moveDialog?localFolderPaths(moveCollection):[];
  const moveTargets=moveDialog&&moveDialog.folderPath?.length?localFolderMoveTargets(
    moveCollection,moveDialog.folderPath):[];
  return <div className="pp-local-collections" aria-label="Local collections">
    {collections.map(col=>{
      const key=`collection:${col.id}`;const opened=!!search||expanded[key]!==false;
      // Closed Local collections keep their expansion state, not a hidden DOM subtree.
      const rawTree=opened?cachedTree(col.requests):null;
      const tree=rawTree&&(col.name.toLowerCase().includes(search.toLowerCase())?rawTree:filterCollectionTree(rawTree,search));
      if(search&&!tree.requests.length&&!tree.folders.length&&!col.name.toLowerCase().includes(search.toLowerCase())
        &&!pendingTabs.some(t=>t.source?.collectionId===col.id && t.name.toLowerCase().includes(search.toLowerCase())))return null;
      return <div key={col.id} className="pp-local-collection" onDragOver={e=>{if(isLocalDrag(e.dataTransfer))e.preventDefault()}} onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');drop(e,col.id,[])}}>
        <div className={`pp-local-collection-head pp-tree-item-container ${dropTarget===key?'pp-folder-drop-target':''}`} style={{'--pp-tree-depth':0}} onDragOver={e=>{if(isLocalDrag(e.dataTransfer)){e.preventDefault();e.stopPropagation();setDropTarget(key);}}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget('');}}
          onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');drop(e,col.id,[]);}}>
          <button type="button" className="pp-tree-row pp-explorer-tree-row" onClick={()=>toggle(key)} title={`${col.name} · Collection root (open to move folders inside)`} aria-expanded={opened} onContextMenu={e=>openMenu(e,{type:'collection',collectionId:col.id,name:col.name})}>
            {opened?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<FolderClosed size={15}/><span>{col.name}</span><small>{col.requests.length}</small>
          </button>
          <div className="pp-tree-actions">
            <button className="pp-tree-action" type="button" title="New request in collection" aria-label={`New request in ${col.name}`} onClick={()=>onAction({action:'newRequest',collectionId:col.id,folderPath:[]})}><Plus size={15}/></button>
            <button className="pp-tree-action" type="button" aria-label={`Actions for collection ${col.name}`} onClick={e=>openMenu(e,{type:'collection',collectionId:col.id,name:col.name})}><Ellipsis size={15}/></button>
          </div>
        </div>
        <div className={`pp-collection-motion ${opened?'is-open':''}`} aria-hidden={!opened} inert={!opened}>
          <div className="pp-collection-motion-inner">{opened&&tree&&<Branch node={tree} collectionId={col.id} search={search} onOpen={onOpen} onOpenExample={onOpenExample} onMenu={openMenu} expanded={expanded} toggle={toggle} onMove={drop} pendingTabs={pendingTabs} onOpenPending={onOpenPending} dropTarget={dropTarget} setDropTarget={setDropTarget}/>}</div>
        </div>
      </div>;
    })}
    {moveDialog&&createPortal(<Dialog title="Move Local folder" subtitle="Choose a source folder and where to put it within this collection." onClose={()=>setMoveDialog(null)}>
      <form className="pp-folder-move-form" onSubmit={e=>{
        e.preventDefault();
        if(!moveDialog.folderPath.length)return;
        onMoveFolder?.({collectionId:moveDialog.collectionId,folderPath:moveDialog.folderPath,
          targetCollectionId:moveDialog.collectionId,targetFolderPath:moveDialog.targetFolderPath});
        setMoveDialog(null);
      }}>
        <label htmlFor="pp-local-folder-move-source">Folder to move</label>
        <select id="pp-local-folder-move-source" autoFocus value={JSON.stringify(moveDialog.folderPath)}
          onChange={e=>setMoveDialog(old=>({...old,folderPath:JSON.parse(e.target.value),targetFolderPath:[]}))}>
          <option value="[]">Select a folder…</option>
          {sourcePaths.map(path=><option key={JSON.stringify(path)} value={JSON.stringify(path)}>{path.join(' / ')}</option>)}
        </select>
        {!sourcePaths.length&&<p className="pp-folder-move-note">This collection has no folders yet. Create a folder first.</p>}
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
      {menus[menu.type].map(([action,label])=><MenuActionItem key={action} action={action} danger={action.startsWith('delete')} onClick={()=>{if(action==='moveFolder'||action==='organizeFolders'){setMoveDialog({collectionId:menu.collectionId,folderPath:action==='moveFolder'?menu.folderPath:[],targetFolderPath:[]});}else onAction({...menu,action});setMenu(null);}}>{label}</MenuActionItem>)}
    </div>,document.body)}
  </div>;
}
