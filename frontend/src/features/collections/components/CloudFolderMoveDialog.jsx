import React from 'react';
import {createPortal} from 'react-dom';
import {Dialog} from '../../../components/ui/WorkbenchPrimitives.jsx';
import {cloudFolderMoveTargets} from '../services/folderMoveTargets.js';
import {folderPathForId} from '../services/cloudFolderTree.js';

/** The move dialog does not own network requests or a second copy of tree state. */
export function CloudFolderMoveDialog({
  moveDialog,setMoveDialog,busy,loading,error,folders,collectionId,collections,
  targetFolders,moveCloudFolder,mutate,onMoveFolder,workspaceId,
}) {
  if (!moveDialog) return null;
  return createPortal(<Dialog title="Move Cloud folder" subtitle="Move the entire folder tree between collections in this workspace." onClose={()=>!busy&&setMoveDialog(null)}>
      <form className="pp-folder-move-form" onSubmit={e=>{
        e.preventDefault();
        if(busy)return;
        if(!moveDialog.folderId)return;
        if(moveDialog.targetCollectionId===collectionId)
          moveCloudFolder(moveDialog.folderId,moveDialog.targetParentId,()=>setMoveDialog(null));
        else {
          const source=folders.find(folder=>folder.id===moveDialog.folderId);
          if(!source)return;
          mutate(async()=>{
            await onMoveFolder?.({workspaceId,collectionId,folderId:source.id,version:source.version,
              targetCollectionId:moveDialog.targetCollectionId,targetParentId:moveDialog.targetParentId});
            setMoveDialog(null);
          });
        }
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
        <label htmlFor="pp-cloud-folder-move-collection">Destination collection</label>
        <select id="pp-cloud-folder-move-collection" disabled={busy} value={moveDialog.targetCollectionId||collectionId}
          onChange={e=>setMoveDialog(old=>({...old,targetCollectionId:e.target.value,targetParentId:null}))}>
          {collections.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <label htmlFor="pp-cloud-folder-move-target">Destination folder</label>
        <select id="pp-cloud-folder-move-target" disabled={busy||!moveDialog.folderId} value={moveDialog.targetParentId||''}
          onChange={e=>setMoveDialog(old=>({...old,targetParentId:e.target.value||null}))}>
          {(moveDialog.targetCollectionId===collectionId?
            cloudFolderMoveTargets(folders,moveDialog.folderId):
            [{id:null,label:'Collection root'},...targetFolders.map(folder=>{
              let label=folder.name;
              try{label=folderPathForId(targetFolders,folder.id).join(' / ');}catch{}
              return {id:folder.id,label};
            }).sort((a,b)=>a.label.localeCompare(b.label))]).map(option=><option key={option.id||'root'} value={option.id||''}>{option.label}</option>)}
        </select>
        {!!error&&<p role="alert" className="pp-env-error">{error}</p>}
        <div className="pp-action-dialog-buttons"><button type="button" disabled={busy} onClick={()=>setMoveDialog(null)}>Cancel</button>
          <button type="submit" disabled={busy||!moveDialog.folderId} className="pp-modal-submit">{busy?'Moving…':'Move folder'}</button></div>
      </form>
    </Dialog>,document.body);
}
