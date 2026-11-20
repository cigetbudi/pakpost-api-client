import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronRight,ChevronDown,FolderClosed,FolderPlus,Plus,Settings2,X,Check,RefreshCw,Trash2} from 'lucide-react';
import {api} from '../../../services/httpClient.js';
import {Dialog} from '../../../components/ui/WorkbenchPrimitives.jsx';
import {MenuActionItem} from '../../../components/ui/MenuActionItem.jsx';
import {makeCloudFolderTree,canMoveCloudFolder,folderPathForId} from '../services/cloudFolderTree.js';
import {folderKey,requestKey,selectCloudItem,buildCloudDeletePayload} from '../services/cloudSelection.js';
import {cloudFolderNameError} from '../services/renameValidation.js';
import {restoreCloudFolderFocus} from '../services/cloudFocus.js';
import {CloudRequestRows} from './CloudRequestRows.jsx';
import {CloudPagedRequestRows} from './CloudPagedRequestRows.jsx';
import {cloudFolderMoveTargets} from '../services/folderMoveTargets.js';
import {startFolderDrag,isFolderDrag,readFolderDrag,endFolderDrag} from '../services/folderDrag.js';

export const CLOUD_FOLDER_DRAG='application/x-pakpost-cloud-folder';
const FOLDER_DRAG=CLOUD_FOLDER_DRAG;
/** The Cloud tree owns keyboard selection. No new global key handler affects the request editor. */
export function CloudFolderTree({workspaceId,collectionId,token,open,requests=[],search='',canEdit=false,activeTabId,activeRequestId,
  requestDrag,renderRequest,renderDraft,onMoveRequest,onCreateDraft,onNotice,onRefreshRequests,onRenameRequest,
  sortByName=false,paged=false,virtualize=true}){
  const [folders,setFolders]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [expanded,setExpanded]=useState({}),[editing,setEditing]=useState(null),[selection,setSelection]=useState([]);
  const [confirmDelete,setConfirmDelete]=useState(null),[menu,setMenu]=useState(null),[dragging,setDragging]=useState(false);
  const [moveDialog,setMoveDialog]=useState(null);
  const [reload,setReload]=useState(0),[busy,setBusy]=useState(false),[dropTarget,setDropTarget]=useState('');
  const rootRef=useRef(null),anchorRef=useRef(''),lastEditedFolderRef=useRef('');
  const pagedRecordsRef=useRef(new Map());
  // Inline folder edit replaces the focused row with an auto-focused input.
  // Restore keyboard focus to the same folder after Cancel/Escape/Save.
  useEffect(()=>{
    if(editing?.mode==='rename'){
      lastEditedFolderRef.current=folderKey(editing.id);
      return;
    }
    if(editing||!lastEditedFolderRef.current)return;
    const key=lastEditedFolderRef.current;
    lastEditedFolderRef.current='';
    const frame=requestAnimationFrame(()=>restoreCloudFolderFocus(rootRef.current,key,document));
    return()=>cancelAnimationFrame(frame);
  },[editing]);
  const base=`/api/workspaces/${workspaceId}/collections/${collectionId}`;
  const refresh=useCallback(()=>setReload(x=>x+1),[]);
  useEffect(()=>{setFolders([]);setEditing(null);setConfirmDelete(null);setSelection([]);setMenu(null);setError('');pagedRecordsRef.current.clear();anchorRef.current='';},[workspaceId,collectionId,token]);
  // A newly activated request is a single selected row; never discard the first click.
  // Ctrl/Shift bulk selection is preserved until the active tab actually changes.
  useEffect(()=>{
    const key=activeRequestId?requestKey(activeRequestId):'';
    setSelection(key?[key]:[]);anchorRef.current=key;
  },[activeTabId,activeRequestId]);
  useEffect(()=>{
    if((!open&&!moveDialog)||!token||!workspaceId)return;
    let alive=true;setLoading(true);
    api(`${base}/folders`,'GET',undefined,token).then(data=>{
      if(alive){setFolders(Array.isArray(data)?data:[]);setError('');}
    }).catch(e=>{if(alive)setError(e.message||'Unable to load folders');})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[open,!!moveDialog,token,workspaceId,collectionId,base,reload]);
  useEffect(()=>{
    const notify=e=>{if(e.detail?.workspaceId===workspaceId&&e.detail?.collectionId===collectionId)refresh();};
    const newFolder=e=>{if(e.detail?.workspaceId===workspaceId&&e.detail?.collectionId===collectionId&&canEdit){
      setEditing({mode:'create',parentId:null,name:''});setMenu(null);
    }};
    const organize=e=>{if(e.detail?.workspaceId===workspaceId&&e.detail?.collectionId===collectionId&&canEdit){
      setError('');setMenu(null);setMoveDialog({folderId:'',targetParentId:null});
    }};
    window.addEventListener('pakpost:cloud-folder-organizer',organize);
    window.addEventListener('pakpost:cloud-folders-changed',notify);
    window.addEventListener('pakpost:cloud-create-folder',newFolder);
    return()=>{window.removeEventListener('pakpost:cloud-folder-organizer',organize);window.removeEventListener('pakpost:cloud-folders-changed',notify);window.removeEventListener('pakpost:cloud-create-folder',newFolder);};
  },[workspaceId,collectionId,canEdit,refresh]);
  useEffect(()=>{
    if(!menu)return;
    const close=e=>{if(!e.target.closest?.('.pp-collection-popup'))setMenu(null);};
    const escape=e=>{if(e.key==='Escape')setMenu(null);};
    window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);};
  },[menu]);
  useEffect(()=>{const end=()=>{setDragging(false);setDropTarget('');endFolderDrag();};
    window.addEventListener('dragend',end);window.addEventListener('drop',end);
    return()=>{window.removeEventListener('dragend',end);window.removeEventListener('drop',end);};
  },[]);
  const mutate=async(makeRequest)=>{
    if(busy||!canEdit)return;
    setBusy(true);setError('');
    try{await makeRequest();setEditing(null);setConfirmDelete(null);setSelection([]);refresh();}
    catch(e){setError(e.message||'Folder update failed');onNotice?.(e.message||'Folder update failed');}
    finally{setBusy(false);}
  };
  const selectedKeys=useMemo(() => new Set(selection), [selection]);
  const folderNameError=editing?cloudFolderNameError(folders,editing):'';
  const visibleFolderNameError=editing?.touched?folderNameError:'';
  const submit=()=>{
    if(!editing||cloudFolderNameError(folders,editing))return;
    if(editing.mode==='create')mutate(()=>api(`${base}/folders`,'POST',{name:editing.name.trim(),parentFolderId:editing.parentId},token));
    else mutate(()=>api(`${base}/folders/${editing.id}`,'PUT',{name:editing.name.trim(),version:editing.version},token));
  };
  const moveCloudFolder=(folderId,targetId,afterMove)=>{
    const current=folders.find(item=>item.id===folderId);
    if(!canEdit||busy||!current)return;
    if(current.parentFolderId===targetId){afterMove?.();return;}
    if(!canMoveCloudFolder(folders,folderId,targetId)){
      onNotice?.('Cannot move a folder into itself or a descendant');return;
    }
    return mutate(async()=>{
      await api(`${base}/folders/${current.id}/move`,'PATCH',
        {parentFolderId:targetId,version:current.version},token);
      afterMove?.();
    });
  };
  const folderMove=async(event,targetId)=>{
    if(!canEdit||busy)return;
    const folder=readFolderDrag(event.dataTransfer,FOLDER_DRAG);
    if(folder){
      event.preventDefault();event.stopPropagation();
      if(folder.collectionId!==collectionId){onNotice?.('Folders can only be moved within the same Cloud collection');return;}
      await moveCloudFolder(folder.folderId,targetId);
      return;
    }
    if(Array.from(event.dataTransfer.types||[]).includes(requestDrag)){
      event.preventDefault();event.stopPropagation();
      await onMoveRequest(event,collectionId,targetId);
      if(paged)refresh();else onRefreshRequests?.();
    }
  };
  // A collection header remains a root drop target even when its tree is collapsed.
  useEffect(()=>{
    const onRootDrop=event=>{
      if(event.detail?.collectionId!==collectionId)return;
      moveCloudFolder(event.detail.folderId,null);
    };
    window.addEventListener('pakpost:cloud-folder-drop-root',onRootDrop);
    return()=>window.removeEventListener('pakpost:cloud-folder-drop-root',onRootDrop);
  },[collectionId,folders,canEdit,busy,token,base]);
  const visibleKeys=()=>Array.from(rootRef.current?.querySelectorAll('[data-cloud-select-key]')||[])
    .map(el=>el.dataset.cloudSelectKey);
  const choose=(event,key)=>{
    const result=selectCloudItem(selection,anchorRef.current,key,visibleKeys(),{
      toggle:event.ctrlKey||event.metaKey,range:event.shiftKey
    });
    setSelection(result.keys);anchorRef.current=result.anchor;
    return !event.ctrlKey&&!event.metaKey&&!event.shiftKey;
  };
  const openMenu=(event,folder)=>{
    event.preventDefault();event.stopPropagation();
    const rect=event.currentTarget.getBoundingClientRect();
    setMenu({folder,x:Math.min(window.innerWidth-225,Math.max(8,event.clientX||rect.right)),
      y:Math.min(window.innerHeight-210,Math.max(8,event.clientY||rect.bottom))});
  };
  const requestDelete=keys=>{if(!canEdit||!keys.length)return;setMenu(null);setConfirmDelete([...keys]);};
  const rename=key=>{
    if(!canEdit||!key)return;
    const [kind,id]=key.split(':');
    if(kind==='folder'){
      const folder=folders.find(f=>f.id===id);
      if(folder)setEditing({mode:'rename',id,name:folder.name,version:folder.version});
    }else if(kind==='request'){
      const request=paged?(pagedRecordsRef.current.get(id)||requests.find(r=>r.id===id)):requests.find(r=>r.id===id);
      if(request)onRenameRequest?.(request);
    }
  };
  const onKeys=event=>{
    if(!canEdit||busy||confirmDelete||editing||menu)return;
    const element=event.target;
    if(element.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]'))return;
    // The focused row remains actionable even if a tab transition just changed selection.
    const focusedKey=element.closest?.('[data-cloud-select-key]')?.dataset.cloudSelectKey;
    const targets=selection.length?selection:(focusedKey?[focusedKey]:[]);
    if((event.key==='Delete'||event.key==='Backspace')&&targets.length){
      event.preventDefault();event.stopPropagation();requestDelete(targets);
    } else if(event.key==='F2'&&targets.length===1){
      event.preventDefault();event.stopPropagation();rename(targets[0]);
    }else if(event.key==='Escape'){setSelection([]);anchorRef.current='';}
  };
  const deleteSelected=()=>{
    let payload;
    try{payload=buildCloudDeletePayload(confirmDelete,folders,paged?
      [...pagedRecordsRef.current.values()]:requests);}
    catch(e){setError(e.message);setConfirmDelete(null);return;}
    mutate(async()=>{
      await api(`${base}/folders/delete-items`,'POST',payload,token);
      if(!paged)await onRefreshRequests?.();
      onNotice?.(`Deleted ${payload.folders.length} folder(s) and ${payload.requestIds.length} directly selected request(s), including folder contents`);
    });
  };
  const node=useMemo(() => open ? makeCloudFolderTree(folders,paged?[]:requests) : null, [open,folders,requests,paged]);
  const filter=String(search||'').trim().toLowerCase();
  const trackPage=(rows,reset)=>{
    if(reset)return;
    for(const row of rows)pagedRecordsRef.current.set(row.id,row);
  };
  useEffect(()=>{
    const listener=e=>{if(paged&&e.detail?.workspaceId===workspaceId&&e.detail?.collectionId===collectionId)
      refresh();};
    window.addEventListener('pakpost:cloud-paged-refresh',listener);
    return()=>window.removeEventListener('pakpost:cloud-paged-refresh',listener);
  },[workspaceId,collectionId,paged,refresh]);
  const pageProps={workspaceId,collectionId,token,search:filter,renderRequest,
    selection,choose,onContextMenu:(event,key)=>{setSelection([key]);anchorRef.current=key;},
    onError:onNotice,onRows:trackPage,refreshKey:reload,virtualize,sortByName};
  // makeCloudFolderTree already disconnects corrupt cycles; no ancestry Set
  // allocation per recursive branch is needed while rendering.
  const renderNode=(branch,depth=0)=>{
    if(paged&&filter)return depth===0?<CloudPagedRequestRows key={`search:${filter}:${reload}`}
      {...pageProps} depth={0} rootOnly={false} virtualize={false}/>:null;
    const children=branch.folders.map(folder=>{
      const isOpen=filter?true:(paged?expanded[folder.id]===true:expanded[folder.id]!==false);
      const key=folderKey(folder.id);
      return <React.Fragment key={folder.id}>
        <div className={`pp-tree-item-container ${dropTarget===folder.id?'pp-folder-drop-target':''}`} style={{'--pp-tree-depth':depth+1}} draggable={canEdit} onDragStart={e=>{
          e.stopPropagation();setDragging(true);startFolderDrag(e.dataTransfer,FOLDER_DRAG,{collectionId,folderId:folder.id});}}
          onDragEnd={()=>{setDragging(false);setDropTarget('');endFolderDrag();}}
          onDragOver={e=>{
            if(!canEdit)return;
            const types=Array.from(e.dataTransfer.types||[]);
            if(types.includes(requestDrag)||isFolderDrag(e.dataTransfer,FOLDER_DRAG)){
              e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setDropTarget(folder.id);
            }
          }}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDropTarget('');}}
          onDrop={e=>{setDropTarget('');folderMove(e,folder.id);endFolderDrag();}}>
          <button type="button" draggable={canEdit} data-cloud-select-key={key} aria-pressed={selectedKeys.has(key)}
            onDragStart={e=>{if(!canEdit)return;e.stopPropagation();setDragging(true);startFolderDrag(e.dataTransfer,FOLDER_DRAG,{collectionId,folderId:folder.id});}}
            onDragOver={e=>{if(canEdit&&(Array.from(e.dataTransfer.types||[]).includes(requestDrag)||isFolderDrag(e.dataTransfer,FOLDER_DRAG))){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setDropTarget(folder.id);}}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();setDropTarget('');folderMove(e,folder.id);endFolderDrag();}}
            className={`pp-tree-row pp-local-folder pp-cloud-folder-row pp-explorer-tree-row ${selectedKeys.has(key)?'pp-cloud-selected':''}`} aria-expanded={isOpen}
            onContextMenu={e=>openMenu(e,folder)}
            onClick={e=>{if(choose(e,key))setExpanded(x=>({...x,[folder.id]:!isOpen}));}}>
            {isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<FolderClosed className="pp-cloud-folder-icon" size={14}/><span>{folder.name}</span>
          </button>
          {canEdit&&<button type="button" className="pp-tree-action" title="Folder settings" aria-label={`Actions for folder ${folder.name}`} onClick={e=>openMenu(e,folder)}><Settings2 size={14}/></button>}
        </div>
        {isOpen&&renderNode(folder,depth+1)}
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
  };
  return <div ref={rootRef} className="pp-cloud-folders" onKeyDown={onKeys}
    onDragOver={e=>{if(canEdit&&(Array.from(e.dataTransfer.types||[]).includes(requestDrag)||isFolderDrag(e.dataTransfer,FOLDER_DRAG)))setDragging(true);}}>
    {canEdit&&dragging&&<div className={`pp-cloud-root-drop ${dropTarget==='root'?'pp-folder-drop-target':''}`}
      onDragOver={e=>{e.preventDefault();e.stopPropagation();setDropTarget('root');}}
      onDragLeave={()=>setDropTarget('')}
      onDrop={e=>{setDragging(false);setDropTarget('');folderMove(e,null);endFolderDrag();}}>Drop here to move to collection root</div>}
    {editing&&<form className="pp-local-create pp-cloud-folder-editor" onSubmit={e=>{e.preventDefault();submit();}}
      onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setEditing(null);}}}>
      <input
        autoFocus
        maxLength={120}
        aria-label="Folder name"
        aria-invalid={!!visibleFolderNameError}
        placeholder="Folder name"
        value={editing.name}
        onChange={e=>setEditing(x=>({...x,name:e.target.value,touched:true}))}
      />
      <button type="submit" disabled={busy||!!folderNameError} aria-label="Save folder"><Check size={14}/></button>
      <button type="button" onClick={()=>setEditing(null)} aria-label="Cancel folder edit"><X size={14}/></button>
      {visibleFolderNameError&&<span className="pp-cloud-folder-validation" role="status">{visibleFolderNameError}</span>}
    </form>}
    {selection.length>1&&canEdit&&<div className="pp-cloud-selection-toolbar">
      <span>{selection.length} selected</span><button type="button" onClick={()=>requestDelete(selection)}><Trash2 size={13}/> Delete</button>
      <button type="button" aria-label="Clear selection" onClick={()=>setSelection([])}><X size={13}/></button>
    </div>}
    {!!error&&<div className="pp-tree-hint" role="alert">{error} <button type="button" onClick={refresh}><RefreshCw size={13}/></button></div>}
    {loading&&<div className="pp-tree-hint">Loading Cloud folders…</div>}
    {paged&&filter&&<div className="pp-tree-hint">Server search by request name (encrypted URLs are not indexed)</div>}
    {open && node && renderNode(node)}
    {menu&&createPortal(<div className="pp-collection-popup" role="menu" style={{left:Math.max(8,menu.x),top:Math.max(8,menu.y)}}>
      <MenuActionItem action="newFolder" onClick={()=>{setEditing({mode:'create',parentId:menu.folder.id,name:''});setMenu(null);}}>New subfolder</MenuActionItem>
      <MenuActionItem action="newRequest" onClick={()=>{onCreateDraft(menu.folder.id);setMenu(null);}}>New request</MenuActionItem>
      {canEdit&&<MenuActionItem action="moveFolder" onClick={()=>{setError('');setMoveDialog({folderId:menu.folder.id,targetParentId:null});setMenu(null);}}>Move to…</MenuActionItem>}
      <MenuActionItem action="renameFolder" onClick={()=>{rename(folderKey(menu.folder.id));setMenu(null);}}>Rename (F2)</MenuActionItem>
      <MenuActionItem action="deleteFolder" danger onClick={()=>requestDelete(selectedKeys.has(folderKey(menu.folder.id))?selection:[folderKey(menu.folder.id)])}>Delete folder and contents</MenuActionItem>
    </div>,document.body)}
    {moveDialog&&createPortal(<Dialog title="Move Cloud folder" subtitle="Choose a folder in this collection or move it back to the root." onClose={()=>!busy&&setMoveDialog(null)}>
      <form className="pp-folder-move-form" onSubmit={e=>{
        e.preventDefault();
        if(busy)return;
        if(!moveDialog.folderId)return;
        moveCloudFolder(moveDialog.folderId,moveDialog.targetParentId,()=>setMoveDialog(null));
      }}>
        <label htmlFor="pp-cloud-folder-move-source">Folder to move</label>
        <select id="pp-cloud-folder-move-source" autoFocus disabled={busy||loading} value={moveDialog.folderId}
          onChange={e=>setMoveDialog(old=>({...old,folderId:e.target.value,targetParentId:null}))}>
          <option value="">Select a folder…</option>
          {folders.map(folder=>{try{return {id:folder.id,label:folderPathForId(folders,folder.id).join(' / ')}}catch{return null}})
            .filter(Boolean).sort((a,b)=>a.label.localeCompare(b.label))
            .map(folder=><option key={folder.id} value={folder.id}>{folder.label}</option>)}
        </select>
        {loading&&<p className="pp-folder-move-note">Loading folders…</p>}
        {!loading&&!folders.length&&<p className="pp-folder-move-note">This collection has no folders yet. Create a folder first.</p>}
        <label htmlFor="pp-cloud-folder-move-target">Destination folder</label>
        <select id="pp-cloud-folder-move-target" disabled={busy||!moveDialog.folderId} value={moveDialog.targetParentId||''}
          onChange={e=>setMoveDialog(old=>({...old,targetParentId:e.target.value||null}))}>
          {cloudFolderMoveTargets(folders,moveDialog.folderId).map(option=><option key={option.id||'root'} value={option.id||''}>{option.label}</option>)}
        </select>
        {!!error&&<p role="alert" className="pp-env-error">{error}</p>}
        <div className="pp-action-dialog-buttons"><button type="button" disabled={busy} onClick={()=>setMoveDialog(null)}>Cancel</button>
          <button type="submit" disabled={busy||!moveDialog.folderId} className="pp-modal-submit">{busy?'Moving…':'Move folder'}</button></div>
      </form>
    </Dialog>,document.body)}
    {confirmDelete&&createPortal(<Dialog title="Delete Cloud items?" subtitle="This action permanently deletes selected requests, all nested folder contents, and request revision history." onClose={()=>!busy&&setConfirmDelete(null)}>
      <p className="pp-cloud-delete-explainer">Delete {confirmDelete.filter(x=>x.startsWith('folder:')).length} selected folder(s) and {confirmDelete.filter(x=>x.startsWith('request:')).length} selected request(s)? Any requests and subfolders inside selected folders will also be removed. This cannot be undone.</p>
      {!!error&&<p role="alert" className="pp-env-error">{error}</p>}
      <form className="pp-action-dialog-buttons" onSubmit={event=>{event.preventDefault();if(!busy)deleteSelected();}}><button type="button" disabled={busy} onClick={()=>setConfirmDelete(null)}>Cancel</button><button autoFocus type="submit" disabled={busy} className="pp-modal-submit">{busy?'Deleting…':'Delete permanently'}</button></form>
    </Dialog>,document.body)}
  </div>;
}
