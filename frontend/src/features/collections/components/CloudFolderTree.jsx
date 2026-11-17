import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronRight,ChevronDown,FolderClosed,FolderPlus,Plus,Settings2,X,Check,RefreshCw,Trash2} from 'lucide-react';
import {api} from '../../../services/httpClient.js';
import {Dialog} from '../../../components/ui/WorkbenchPrimitives.jsx';
import {MenuActionItem} from '../../../components/ui/MenuActionItem.jsx';
import {makeCloudFolderTree,canMoveCloudFolder} from '../services/cloudFolderTree.js';
import {folderKey,requestKey,selectCloudItem,buildCloudDeletePayload} from '../services/cloudSelection.js';
import {cloudFolderNameError} from '../services/renameValidation.js';
import {restoreCloudFolderFocus} from '../services/cloudFocus.js';

const FOLDER_DRAG='application/x-pakpost-cloud-folder';
/** The Cloud tree owns keyboard selection. No new global key handler affects the request editor. */
export function CloudFolderTree({workspaceId,collectionId,token,open,requests=[],search='',canEdit=false,activeTabId,activeRequestId,
  requestDrag,renderRequest,renderDraft,onMoveRequest,onCreateDraft,onNotice,onRefreshRequests,onRenameRequest,sortByName=false}){
  const [folders,setFolders]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [expanded,setExpanded]=useState({}),[editing,setEditing]=useState(null),[selection,setSelection]=useState([]);
  const [confirmDelete,setConfirmDelete]=useState(null),[menu,setMenu]=useState(null),[dragging,setDragging]=useState(false);
  const [reload,setReload]=useState(0),[busy,setBusy]=useState(false);
  const rootRef=useRef(null),anchorRef=useRef(''),lastEditedFolderRef=useRef('');
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
  useEffect(()=>{setFolders([]);setEditing(null);setConfirmDelete(null);setSelection([]);setMenu(null);setError('');anchorRef.current='';},[workspaceId,collectionId,token]);
  // A newly activated request is a single selected row; never discard the first click.
  // Ctrl/Shift bulk selection is preserved until the active tab actually changes.
  useEffect(()=>{
    const key=activeRequestId?requestKey(activeRequestId):'';
    setSelection(key?[key]:[]);anchorRef.current=key;
  },[activeTabId,activeRequestId]);
  useEffect(()=>{
    if(!open||!token||!workspaceId)return;
    let alive=true;setLoading(true);
    api(`${base}/folders`,'GET',undefined,token).then(data=>{
      if(alive){setFolders(Array.isArray(data)?data:[]);setError('');}
    }).catch(e=>{if(alive)setError(e.message||'Unable to load folders');})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[open,token,workspaceId,collectionId,base,reload]);
  useEffect(()=>{
    const notify=e=>{if(e.detail?.workspaceId===workspaceId&&e.detail?.collectionId===collectionId)refresh();};
    const newFolder=e=>{if(e.detail?.workspaceId===workspaceId&&e.detail?.collectionId===collectionId&&canEdit){
      setEditing({mode:'create',parentId:null,name:''});setMenu(null);
    }};
    window.addEventListener('pakpost:cloud-folders-changed',notify);
    window.addEventListener('pakpost:cloud-create-folder',newFolder);
    return()=>{window.removeEventListener('pakpost:cloud-folders-changed',notify);window.removeEventListener('pakpost:cloud-create-folder',newFolder);};
  },[workspaceId,collectionId,canEdit,refresh]);
  useEffect(()=>{
    if(!menu)return;
    const close=e=>{if(!e.target.closest?.('.pp-collection-popup'))setMenu(null);};
    const escape=e=>{if(e.key==='Escape')setMenu(null);};
    window.addEventListener('pointerdown',close);window.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',escape);};
  },[menu]);
  useEffect(()=>{const end=()=>setDragging(false);
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
  const folderNameError=editing?cloudFolderNameError(folders,editing):'';
  const submit=()=>{
    if(!editing||cloudFolderNameError(folders,editing))return;
    if(editing.mode==='create')mutate(()=>api(`${base}/folders`,'POST',{name:editing.name.trim(),parentFolderId:editing.parentId},token));
    else mutate(()=>api(`${base}/folders/${editing.id}`,'PUT',{name:editing.name.trim(),version:editing.version},token));
  };
  const folderMove=async(event,targetId)=>{
    if(!canEdit)return;
    const types=Array.from(event.dataTransfer.types||[]);
    if(types.includes(requestDrag)){
      event.preventDefault();event.stopPropagation();
      await onMoveRequest(event,collectionId,targetId);
      onRefreshRequests?.();return;
    }
    if(types.includes(FOLDER_DRAG)){
      event.preventDefault();event.stopPropagation();
      let value;try{value=JSON.parse(event.dataTransfer.getData(FOLDER_DRAG));}catch{return;}
      if(value.collectionId!==collectionId||!canMoveCloudFolder(folders,value.folderId,targetId))return;
      const current=folders.find(f=>f.id===value.folderId);
      if(!current||current.parentFolderId===targetId)return;
      await mutate(()=>api(`${base}/folders/${current.id}/move`,'PATCH',{parentFolderId:targetId,version:current.version},token));
    }
  };
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
      const request=requests.find(r=>r.id===id);
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
    try{payload=buildCloudDeletePayload(confirmDelete,folders,requests);}
    catch(e){setError(e.message);setConfirmDelete(null);return;}
    mutate(async()=>{
      await api(`${base}/folders/delete-items`,'POST',payload,token);
      await onRefreshRequests?.();
      onNotice?.(`Deleted ${payload.folders.length} folder(s) and ${payload.requestIds.length} directly selected request(s), including folder contents`);
    });
  };
  const node=makeCloudFolderTree(folders,requests);
  const filter=String(search||'').trim().toLowerCase();
  const renderNode=(branch,depth=0,visited=new Set())=>{
    if(branch.id&&visited.has(branch.id))return null;
    const seen=new Set(visited);if(branch.id)seen.add(branch.id);
    const children=branch.folders.map(folder=>{
      const isOpen=filter?true:expanded[folder.id]!==false;
      const key=folderKey(folder.id);
      return <React.Fragment key={folder.id}>
        <div className="pp-tree-item-container" draggable={canEdit} onDragStart={e=>{
          e.stopPropagation();setDragging(true);e.dataTransfer.effectAllowed='move';
          e.dataTransfer.setData(FOLDER_DRAG,JSON.stringify({collectionId,folderId:folder.id}));}}
          onDragOver={e=>{if(canEdit&&(Array.from(e.dataTransfer.types||[]).includes(FOLDER_DRAG)||Array.from(e.dataTransfer.types||[]).includes(requestDrag)))e.preventDefault();}}
          onDrop={e=>folderMove(e,folder.id)}>
          <button type="button" data-cloud-select-key={key} aria-pressed={selection.includes(key)}
            className={`pp-tree-row pp-local-folder pp-cloud-folder-row ${selection.includes(key)?'pp-cloud-selected':''}`}
            style={{paddingLeft:17+depth*14}} aria-expanded={isOpen}
            onContextMenu={e=>openMenu(e,folder)}
            onClick={e=>{if(choose(e,key))setExpanded(x=>({...x,[folder.id]:!isOpen}));}}>
            {isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<FolderClosed className="pp-cloud-folder-icon" size={14}/><span>{folder.name}</span>
          </button>
          {canEdit&&<button type="button" className="pp-tree-action" title="Folder settings" aria-label={`Actions for folder ${folder.name}`} onClick={e=>openMenu(e,folder)}><Settings2 size={14}/></button>}
        </div>
        {isOpen&&renderNode(folder,depth+1,seen)}
      </React.Fragment>;
    });
    const sorted=sortByName?[...branch.requests].sort((a,b)=>a.name.localeCompare(b.name)):branch.requests;
    const items=sorted.filter(r=>!filter||`${r.name} ${r.url}`.toLowerCase().includes(filter))
      .map(r=>renderRequest(r,depth,{
        'data-cloud-select-key':requestKey(r.id),'aria-pressed':selection.includes(requestKey(r.id)),
        className:selection.includes(requestKey(r.id))?'pp-cloud-selected':'',
        onClick:e=>choose(e,requestKey(r.id)),
        onContextMenu:e=>{setSelection([requestKey(r.id)]);anchorRef.current=requestKey(r.id);}
      }));
    return <>{children}{items}{renderDraft?.(branch.id,depth)}</>;
  };
  return <div ref={rootRef} className="pp-cloud-folders" onKeyDown={onKeys}
    onDragOver={e=>{if(canEdit&&Array.from(e.dataTransfer.types||[]).some(t=>t===requestDrag||t===FOLDER_DRAG))setDragging(true);}}>
    {canEdit&&dragging&&<div className="pp-cloud-root-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{setDragging(false);folderMove(e,null);}}>Drop here to move to collection root</div>}
    {editing&&<form className="pp-local-create" onSubmit={e=>{e.preventDefault();submit();}}
      onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setEditing(null);}}}>
      <input autoFocus maxLength={120} aria-label="Folder name" aria-invalid={!!folderNameError} placeholder="Folder name" value={editing.name} onChange={e=>setEditing(x=>({...x,name:e.target.value}))}/>
      <button type="submit" disabled={busy||!!folderNameError} aria-label="Save folder"><Check size={14}/></button>
      <button type="button" onClick={()=>setEditing(null)} aria-label="Cancel folder edit"><X size={14}/></button>
      {folderNameError&&<span className="pp-cloud-folder-validation" role="status">{folderNameError}</span>}
    </form>}
    {selection.length>1&&canEdit&&<div className="pp-cloud-selection-toolbar">
      <span>{selection.length} selected</span><button type="button" onClick={()=>requestDelete(selection)}><Trash2 size={13}/> Delete</button>
      <button type="button" aria-label="Clear selection" onClick={()=>setSelection([])}><X size={13}/></button>
    </div>}
    {!!error&&<div className="pp-tree-hint" role="alert">{error} <button type="button" onClick={refresh}><RefreshCw size={13}/></button></div>}
    {loading&&<div className="pp-tree-hint">Loading Cloud folders…</div>}
    {renderNode(node)}
    {menu&&createPortal(<div className="pp-collection-popup" role="menu" style={{left:Math.max(8,menu.x),top:Math.max(8,menu.y)}}>
      <MenuActionItem action="newFolder" onClick={()=>{setEditing({mode:'create',parentId:menu.folder.id,name:''});setMenu(null);}}>New subfolder</MenuActionItem>
      <MenuActionItem action="newRequest" onClick={()=>{onCreateDraft(menu.folder.id);setMenu(null);}}>New request</MenuActionItem>
      <MenuActionItem action="renameFolder" onClick={()=>{rename(folderKey(menu.folder.id));setMenu(null);}}>Rename (F2)</MenuActionItem>
      <MenuActionItem action="deleteFolder" danger onClick={()=>requestDelete(selection.includes(folderKey(menu.folder.id))?selection:[folderKey(menu.folder.id)])}>Delete folder and contents</MenuActionItem>
    </div>,document.body)}
    {confirmDelete&&createPortal(<Dialog title="Delete Cloud items?" subtitle="This action permanently deletes selected requests, all nested folder contents, and request revision history." onClose={()=>!busy&&setConfirmDelete(null)}>
      <p className="pp-cloud-delete-explainer">Delete {confirmDelete.filter(x=>x.startsWith('folder:')).length} selected folder(s) and {confirmDelete.filter(x=>x.startsWith('request:')).length} selected request(s)? Any requests and subfolders inside selected folders will also be removed. This cannot be undone.</p>
      {!!error&&<p role="alert" className="pp-env-error">{error}</p>}
      <form className="pp-action-dialog-buttons" onSubmit={event=>{event.preventDefault();if(!busy)deleteSelected();}}><button type="button" disabled={busy} onClick={()=>setConfirmDelete(null)}>Cancel</button><button autoFocus type="submit" disabled={busy} className="pp-modal-submit">{busy?'Deleting…':'Delete permanently'}</button></form>
    </Dialog>,document.body)}
  </div>;
}
