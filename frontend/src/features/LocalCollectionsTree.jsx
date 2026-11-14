import React, {useState} from 'react';
import {ChevronDown,ChevronRight,FolderClosed,Trash2} from 'lucide-react';
import {filterCollectionTree,makeCollectionTree} from './localCollections';

function Branch({node,collectionId,path=[],depth=0,search,onOpen,expanded,toggle}){
  return <>
    {node.folders.map(folder=>{
      const folderPath=[...path,folder.name];const key=`${collectionId}:${JSON.stringify(folderPath)}`;
      const opened=search||expanded[key]!==false;
      return <React.Fragment key={key}>
        <button className="pp-tree-row pp-local-folder" style={{paddingLeft:17+depth*14}} onClick={()=>toggle(key)} title={folderPath.join(' / ')}>
          {opened?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<FolderClosed size={14}/><span>{folder.name}</span>
        </button>
        {opened&&<Branch node={folder} collectionId={collectionId} path={folderPath} depth={depth+1} search={search} onOpen={onOpen} expanded={expanded} toggle={toggle}/>}
      </React.Fragment>;
    })}
    {node.requests.map(r=><button key={r.id} className="pp-tree-request pp-local-request" style={{paddingLeft:26+(depth*14)}} title={r.url} onClick={()=>onOpen(r)}>
      <span className={`pp-http-label ${(r.method||'GET').toLowerCase()}`}>{r.method||'GET'}</span><span>{r.requestName||r.name}</span>
    </button>)}
  </>;
}

export function LocalCollectionsTree({collections,search='',onOpen,onDelete}){
  const [expanded,setExpanded]=useState({});
  const [pendingDelete,setPendingDelete]=useState(null);
  const toggle=key=>setExpanded(old=>({...old,[key]:old[key]===false?true:false}));
  return <div className="pp-local-collections" aria-label="Local collections">
    {collections.map(col=>{
      const tree=col.name.toLowerCase().includes(search.toLowerCase())?makeCollectionTree(col.requests):filterCollectionTree(makeCollectionTree(col.requests),search);
      if(search&&!tree.requests.length&&!tree.folders.length&&!col.name.toLowerCase().includes(search.toLowerCase()))return null;
      const key=`collection:${col.id}`;const opened=!!search||expanded[key]!==false;
      return <div key={col.id} className="pp-local-collection">
        <div className="pp-local-collection-head">
          <button className="pp-tree-row" onClick={()=>toggle(key)} title={col.name} aria-expanded={opened}>
            {opened?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<FolderClosed size={15}/><span>{col.name}</span><small>{col.requests.length}</small>
          </button>
          <button className="pp-local-delete" onClick={()=>setPendingDelete(col.id)} aria-label={`Delete local collection ${col.name}`} title="Delete local collection"><Trash2 size={13}/></button>
        </div>
        {pendingDelete===col.id&&<div className="pp-local-delete-confirm"><span>Delete collection and {col.requests.length} request(s)?</span><button onClick={()=>{onDelete(col.id);setPendingDelete(null)}}>Delete</button><button onClick={()=>setPendingDelete(null)}>Cancel</button></div>}
        {opened&&<Branch node={tree} collectionId={col.id} search={search} onOpen={onOpen} expanded={expanded} toggle={toggle}/>}
      </div>;
    })}
  </div>;
}
