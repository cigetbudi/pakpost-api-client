import React from 'react';
import {ChevronRight,ChevronDown,FolderClosed,Settings2} from 'lucide-react';
import {CloudRequestRows} from './CloudRequestRows.jsx';
import {CloudPagedRequestRows} from './CloudPagedRequestRows.jsx';

// Render-only recursion; CloudFolderTree owns selection, API requests and drag state.
// makeCloudFolderTree already disconnects corrupt cycles.
export function renderCloudFolderNodes(branch,depth,ctx){
  const {paged,filter,reload,pageProps,expanded,folderKey,dropTarget,canEdit,setDragging,
    startFolderDrag,FOLDER_DRAG,workspaceId,collectionId,requestDrag,isFolderDrag,
    setDropTarget,folderMove,endFolderDrag,selectedKeys,openMenu,choose,setExpanded,
    renderRequest,selection,setSelection,anchorRef,sortByName,renderDraft}=ctx;
    if(paged&&filter)return depth===0?<CloudPagedRequestRows key={`search:${filter}:${reload}`}
      {...pageProps} depth={0} rootOnly={false} virtualize={false}/>:null;
    const children=branch.folders.map(folder=>{
      const isOpen=filter?true:(paged?expanded[folder.id]===true:expanded[folder.id]!==false);
      const key=folderKey(folder.id);
      return <React.Fragment key={folder.id}>
        <div className={`pp-tree-item-container ${dropTarget===folder.id?'pp-folder-drop-target':''}`} style={{'--pp-tree-depth':depth+1}} draggable={canEdit} onDragStart={e=>{
          e.stopPropagation();setDragging(true);startFolderDrag(e.dataTransfer,FOLDER_DRAG,{workspaceId,collectionId,folderId:folder.id,version:folder.version});}}
          onDragEnd={()=>{setDragging(false);setDropTarget('');endFolderDrag();}}
          onDragOver={e=>{
            if(!canEdit)return;
            const types=Array.from(e.dataTransfer.types||[]);
            if(types.includes(requestDrag)||isFolderDrag(e.dataTransfer,FOLDER_DRAG)){
              e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setDropTarget(folder.id);
            }
          }}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget('');}}
          onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');folderMove(e,folder.id);endFolderDrag();}}>
          <button type="button" draggable={canEdit} data-cloud-select-key={key} aria-pressed={selectedKeys.has(key)}
            onDragStart={e=>{if(!canEdit)return;e.stopPropagation();setDragging(true);startFolderDrag(e.dataTransfer,FOLDER_DRAG,{workspaceId,collectionId,folderId:folder.id,version:folder.version});}}
            onDragOver={e=>{if(canEdit&&(Array.from(e.dataTransfer.types||[]).includes(requestDrag)||isFolderDrag(e.dataTransfer,FOLDER_DRAG))){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setDropTarget(folder.id);}}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');folderMove(e,folder.id);endFolderDrag();}}
            className={`pp-tree-row pp-local-folder pp-cloud-folder-row pp-explorer-tree-row ${selectedKeys.has(key)?'pp-cloud-selected':''}`} aria-expanded={isOpen}
            onContextMenu={e=>openMenu(e,folder)}
            onClick={e=>{if(choose(e,key))setExpanded(x=>({...x,[folder.id]:!isOpen}));}}>
            {isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<FolderClosed className="pp-cloud-folder-icon" size={14}/><span>{folder.name}</span>
          </button>
          {canEdit&&<button type="button" className="pp-tree-action" title="Folder settings" aria-label={`Actions for folder ${folder.name}`} onClick={e=>openMenu(e,folder)}><Settings2 size={14}/></button>}
        </div>
        {isOpen&&renderCloudFolderNodes(folder,depth+1,ctx)}
      </React.Fragment>;
    });
    return <>{children}
      {paged?<CloudPagedRequestRows key={`paged:${branch.id||'root'}:${reload}`} {...pageProps}
        folderId={branch.id||null} rootOnly={!branch.id} depth={depth} />:
      <CloudRequestRows key={`${branch.id||'root'}:${filter}:${sortByName}`}
        requests={branch.requests} search={filter} sortByName={sortByName} depth={depth}
        renderRequest={renderRequest} selection={selection} choose={choose}
        onContextMenu={(event,key)=>{setSelection([key]);anchorRef.current=key;}} />}
      {renderDraft?.(branch.id,depth)}
    </>;
}
