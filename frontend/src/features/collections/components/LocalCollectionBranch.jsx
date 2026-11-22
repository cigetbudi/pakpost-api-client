import React from 'react';
import {ChevronDown,ChevronRight,FolderClosed,Ellipsis} from 'lucide-react';
import {statusTone} from '../../requests/services/responseExamples.js';
import {startFolderDrag,isFolderDrag,endFolderDrag} from '../services/folderDrag.js';
import {dragRowPlacement} from '../services/requestDrag.js';

const DRAG_MIME='application/x-pakpost-local-request';
const FOLDER_DRAG_MIME='application/x-pakpost-local-folder';
const isLocalDrag=transfer=>isFolderDrag(transfer,FOLDER_DRAG_MIME)||Array.from(transfer?.types||[]).includes(DRAG_MIME);

export function LocalCollectionBranch({node,collectionId,path=[],depth=0,search,onOpen,onOpenExample,onMenu,expanded,toggle,onMove,pendingTabs,onOpenPending,dropTarget,setDropTarget}){
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
          <div className="pp-collection-motion-inner">{opened&&<LocalCollectionBranch node={folder} collectionId={collectionId} path={folderPath} depth={depth+1} search={search} onOpen={onOpen} onOpenExample={onOpenExample} onMenu={onMenu} expanded={expanded} toggle={toggle} onMove={onMove} pendingTabs={pendingTabs} onOpenPending={onOpenPending} dropTarget={dropTarget} setDropTarget={setDropTarget}/>}</div>
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
        <div className={`pp-tree-item-container ${dropTarget===`req:${r.id}:before`?'pp-request-drop-before':''} ${dropTarget===`req:${r.id}:after`?'pp-request-drop-after':''}`}
          style={{'--pp-tree-depth':depth+1}} draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData(DRAG_MIME,JSON.stringify({collectionId,requestId:r.id}));}}
          onDragEnd={()=>setDropTarget('')}
          onDragOver={e=>{if(Array.from(e.dataTransfer.types||[]).includes(DRAG_MIME)){
            e.preventDefault();e.stopPropagation();setDropTarget(`req:${r.id}:${dragRowPlacement(e)}`);
          }}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget('');}}
          onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');onMove(e,collectionId,path,r.id,dragRowPlacement(e));}}>
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
