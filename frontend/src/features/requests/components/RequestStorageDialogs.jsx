import {renameActionError} from '../../collections/services/renameValidation.js';
import {workspaceCollectionKey} from '../../collections/services/collectionExpansion.js';
// Only renders its dialogs. Mutation and permission checks remain owned by Workbench.
export function RequestStorageDialogs(props) {
  const { Dialog, FileUp, ImportDestinationPicker, RetroSelect, Save, actionDialog, actionName, activeWorkspace, busyAction, canEditCloud, collectionImportBusy, collectionImportDestination, collectionImportError, collectionImportFile, collectionImportOpen, executeActionDialog, localCollections, saveCollection, saveCols, saveLocalCollection, saveName, saveOpen, saveRequest, saveScope, saveWs, setActionDialog, setActionName, setAuthMode, setAuthOpen, setCollectionImportDestination, setCollectionImportError, setCollectionImportFile, setCollectionImportOpen, setSaveCollection, setSaveLocalCollection, setSaveName, setSaveOpen, setSaveScope, setSaveWs, submitCollectionImport, token, workspaces, collections, workspaceRequestLists, selectedWs } = props;
  const renameError=renameActionError(actionDialog,actionName,{collections,localCollections,workspaceRequestLists,selectedWs,workspaceCollectionKey});
  return <>
    {saveOpen && <Dialog title="Save as new request" subtitle="Keep an independent copy in a local collection or a signed-in workspace." onClose={()=>setSaveOpen(false)}><form className="modal-form" onSubmit={saveRequest}>
      <label>Request name<input autoFocus required maxLength={120} value={saveName} onChange={e=>setSaveName(e.target.value)}/></label>
      <div className="pp-modal-select-label"><span>Destination</span><RetroSelect ariaLabel="Save scope" value={saveScope} onChange={setSaveScope} options={[{value:'local',label:'Local browser'},...(token&&canEditCloud?[{value:'workspace',label:'Workspace · Neon'}]:[])]}/></div>
      {saveScope==='local'?<div className="pp-modal-select-label"><span>Local collection</span><RetroSelect ariaLabel="Local collection" value={saveLocalCollection} onChange={setSaveLocalCollection} options={localCollections.map(c=>({value:c.id,label:c.name}))}/></div>:
        <><div className="pp-modal-select-label"><span>Workspace</span><RetroSelect ariaLabel="Save workspace" value={saveWs} onChange={setSaveWs} options={workspaces.map(w=>({value:w.id,label:w.name}))}/></div><div className="pp-modal-select-label"><span>Collection</span><RetroSelect ariaLabel="Save collection" value={saveCollection} onChange={setSaveCollection} options={saveCols.map(c=>({value:c.id,label:c.name}))}/></div></>}
      {!(saveScope==='local'?localCollections.length:saveCols.length)&&<div className="form-error">Create a collection first.</div>}
      <button className="pp-modal-submit" type="submit" disabled={!(saveScope==='local'?saveLocalCollection:saveCollection)||busyAction}><Save size={16}/> Save new request</button>
    </form></Dialog>}
    {collectionImportOpen&&<Dialog title="Import collection" subtitle="Postman v2.1, OpenAPI JSON, Insomnia v4 JSON or cURL" onClose={()=>{if(!collectionImportBusy)setCollectionImportOpen(false)}}>
      <div className="pp-collection-import-dialog">
        <ImportDestinationPicker authenticated={!!token} allowCloud={canEditCloud} workspaceName={activeWorkspace?.name||''} value={collectionImportDestination} onChange={setCollectionImportDestination} onLogin={()=>{setCollectionImportOpen(false);setAuthMode('login');setAuthOpen(true);}}/>
        <label className="pp-collection-file-picker"><FileUp size={17}/><span>{collectionImportFile?.name||'Choose a collection file'}</span><input type="file" accept=".json,.txt,.curl,.sh,application/json,text/plain" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setCollectionImportError('');if(file.size>3*1024*1024){setCollectionImportError('Maximum collection import size is 3 MB.');return;}setCollectionImportFile(file);}}/></label>
        {collectionImportError&&<p role="alert" className="pp-env-error">{collectionImportError}</p>}
        <div className="pp-collection-import-actions"><button type="button" disabled={collectionImportBusy} onClick={()=>setCollectionImportOpen(false)}>Cancel</button><button type="button" className="pp-env-primary" disabled={collectionImportBusy||!collectionImportFile} onClick={submitCollectionImport}><FileUp size={15}/>{collectionImportBusy?'Importing…':'Import collection'}</button></div>
      </div>
    </Dialog>}
    {actionDialog&&<Dialog title={{renameCollection:'Rename collection',renameRequest:'Rename request',renameFolder:'Rename folder',deleteCollection:'Delete collection',deleteRequest:'Delete request',deleteFolder:'Delete folder',renameExample:'Rename example',deleteExample:'Delete example'}[actionDialog.action]||'Manage collection'} subtitle={actionDialog.action.startsWith('delete')?'This action cannot be undone. Open tabs will not be closed.':'Changes will be reflected in Collections.'} onClose={()=>setActionDialog(null)}>
      <form className="modal-form" onSubmit={executeActionDialog} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setActionDialog(null);}}}>
        {actionDialog.action.startsWith('rename')?<label>Name<input autoFocus required aria-invalid={!!renameError} maxLength={actionDialog.action==='renameExample'?140:120} value={actionName} onChange={e=>setActionName(e.target.value)}/>{renameError&&<span role="status" className="pp-rename-validation">{renameError}</span>}</label>:<p>Delete <strong>{actionDialog.name}</strong>?</p>}
        <div className="pp-action-dialog-buttons"><button type="button" onClick={()=>setActionDialog(null)}>Cancel</button><button type="submit" disabled={busyAction||!!renameError} className="pp-modal-submit">{actionDialog.action.startsWith('delete')?'Delete':'Rename'}</button></div>
      </form>
    </Dialog>}
  </>;
}
