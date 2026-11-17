import {renameActionError} from '../../collections/services/renameValidation.js';
import {workspaceCollectionKey} from '../../collections/services/collectionExpansion.js';

// Presentation-only composition: state, API calls and mutation stay in App until their controllers are extracted.
// Each dependency is explicit so this component can be tested independently.
export function RequestDialogs(props) {
  const {
    Dialog, FileUp, ImportDestinationPicker, RequestRevisionPanel, RetroSelect, Save, Suspense,
    actionDialog, actionName, activeSource, activeTabId, activeWorkspace, applyMergedRevision, busyAction,
    canEditCloud, closeConfirmation, collectionImportBusy, collectionImportDestination, collectionImportError, collectionImportFile, collectionImportOpen,
    conflictDialog, draftsRef, exampleDescription, exampleName, executeActionDialog, isReadOnlyCloudTab, localCollections, collections, workspaceRequestLists,
    openTabs, performTabAction, reloadCloudConflict, restoreRequestRevision, result, saveCollection, saveCols,
    saveConflictCopy, saveExampleOpen, saveLocalCollection, saveName, saveOpen, saveRequest, saveResponseExample,
    saveScope, saveWs, selectRequestHistoryRevision, selectedWs, setActionDialog, setActionName, setAuthMode,
    setAuthOpen, setCloseConfirmation, setCollectionImportDestination, setCollectionImportError, setCollectionImportFile, setCollectionImportOpen, setConflictDialog,
    setExampleDescription, setExampleName, setSaveCollection, setSaveExampleOpen, setSaveLocalCollection, setSaveName, setSaveOpen,
    setSaveScope, setSaveWs, setVersionDialog, snapshot, statusTone, submitCollectionImport, token,
    versionDialog, workspaceDraft, workspaces,
  } = props;
  const renameError=renameActionError(actionDialog,actionName,{collections,localCollections,workspaceRequestLists,selectedWs,workspaceCollectionKey});
  return <>
    {closeConfirmation&&<Dialog title="Unsaved changes" subtitle="Changes in these tabs have not been saved to their collections." onClose={()=>setCloseConfirmation(null)}>
      <div className="pp-unsaved-confirm">
        <p>{closeConfirmation.unsaved.length===1?'This request has unsaved changes:':`${closeConfirmation.unsaved.length} requests have unsaved changes:`}</p>
        <ul>{closeConfirmation.unsaved.map(id=><li key={id}>{openTabs.find(t=>t.id===id)?.name||'Request'}</li>)}</ul>
        <p>Discard these changes and close {closeConfirmation.action==='close'?'the tab':'the selected tabs'}?</p>
        <div className="pp-action-dialog-buttons">
          <button type="button" onClick={()=>setCloseConfirmation(null)}>Keep editing</button>
          <button className="pp-destructive-confirm" type="button" onClick={()=>performTabAction(closeConfirmation.action,closeConfirmation.id,true)}>Discard & close</button>
        </div>
      </div>
    </Dialog>}
    {saveExampleOpen && <Dialog title="Save response example" subtitle="Capture the latest response as an example for this request." onClose={()=>setSaveExampleOpen(false)}><form className="modal-form" onSubmit={saveResponseExample}>
      <label>Example name<input autoFocus required maxLength={140} value={exampleName} onChange={e=>setExampleName(e.target.value)}/></label>
      <label>Description <textarea rows={3} maxLength={1000} placeholder="Optional note, e.g. when to expect this response" value={exampleDescription} onChange={e=>setExampleDescription(e.target.value)}/></label>
      <p className="pp-example-warning">Review the response body before saving. It can contain personal data, tokens, or account details. Known sensitive response headers are redacted; the body is saved as-is (up to 64 KB). {isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabId),canEditCloud,selectedWs)?'Sandbox only: this example is not saved to Cloud and is lost when you close or refresh the session.':(!activeSource()||activeSource()?.pending?'This is a draft; use Save to keep this example in a collection.':'')}</p>
      {result && !result.error && <div className="pp-example-preview"><span className={`pp-example-status ${statusTone(result.statusCode)}`}>{result.statusCode}</span><strong>{result.reasonPhrase || 'HTTP response'}</strong><small>{new Blob([result.body || '']).size.toLocaleString()} B · {result.elapsedMs} ms</small></div>}
      <button className="pp-modal-submit" type="submit" disabled={!result||!!result.error||busyAction}><Save size={16}/> Save example</button>
    </form></Dialog>}
    {versionDialog&&<Dialog wide title="Request Version History" subtitle="Encrypted revision snapshots · Field-level comparison · No silent Cloud overwrite" onClose={()=>{if(!versionDialog.busy)setVersionDialog(null)}}>
      {versionDialog.loading&&!versionDialog.entries.length?<p className="pp-revision-empty">Loading version history…</p>:
        <Suspense fallback={<p className="pp-revision-empty">Loading revision viewer…</p>}><RequestRevisionPanel mode="history"
          history={versionDialog.entries} selectedRevision={versionDialog.selectedRevision}
          localDraft={{...((versionDialog.tabId===activeTabId?snapshot():draftsRef.current[versionDialog.tabId])||{}),name:openTabs.find(t=>t.id===versionDialog.tabId)?.name}}
          remoteDraft={versionDialog.detail?workspaceDraft(versionDialog.detail.request):null}
          currentRevision={versionDialog.latest?.revision} canRestore={canEditCloud}
          busy={versionDialog.busy||versionDialog.loading} error={versionDialog.error}
          onSelectRevision={rev=>selectRequestHistoryRevision(versionDialog.tabId,versionDialog.path,rev)}
          onMerge={chosen=>{applyMergedRevision(versionDialog.tabId,versionDialog.detail?.request,chosen);setVersionDialog(null);}}
          onRestore={restoreRequestRevision} onClose={()=>setVersionDialog(null)}/></Suspense>}
    </Dialog>}
    {conflictDialog&&<Dialog wide title="Cloud changes detected" subtitle="Another session has saved a newer version. Your local draft has not been overwritten." onClose={()=>setConflictDialog(null)}>
      <div className="pp-conflict-conflict-dialog">
        {conflictDialog.loading?<p>Loading latest Cloud revision…</p>:<>
          <p><strong>Local revision:</strong> {conflictDialog.source.revision||'Unknown'} · <strong>Cloud revision:</strong> {conflictDialog.latest?.revision||'Not found'}</p>
          {conflictDialog.error&&<p role="alert" className="pp-conflict-error">{conflictDialog.error}</p>}
          {!conflictDialog.latest&&<p>Cloud request is missing or inaccessible. Save your current draft as a Local copy to keep it.</p>}
          {!!conflictDialog.latest&&<Suspense fallback={<p>Loading compare view…</p>}><RequestRevisionPanel mode="conflict"
            localDraft={{...((conflictDialog.tabId===activeTabId?snapshot():draftsRef.current[conflictDialog.tabId])||{}),name:openTabs.find(t=>t.id===conflictDialog.tabId)?.name}}
            remoteDraft={workspaceDraft(conflictDialog.latest)} baseDraft={conflictDialog.base?workspaceDraft(conflictDialog.base):null}
            onMerge={chosen=>applyMergedRevision(conflictDialog.tabId,conflictDialog.latest,chosen,{resolveConflict:true})}
            onClose={()=>setConflictDialog(null)} /></Suspense>}
          <p className="pp-conflict-warning">Reload discards your unsaved changes. Applying selected fields preserves the draft; review it and press Save separately. Force Overwrite remains unavailable.</p>
        </>}
        <div className="pp-conflict-actions">
          <button type="button" onClick={()=>setConflictDialog(null)}>Keep editing</button>
          <button type="button" onClick={saveConflictCopy}>Save as Local Copy</button>
          <button type="button" disabled={conflictDialog.loading||!conflictDialog.latest} onClick={reloadCloudConflict} className="pp-conflict-destructive">Discard draft & reload Cloud</button>
        </div>
      </div>
    </Dialog>}
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
