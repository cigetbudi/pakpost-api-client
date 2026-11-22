// Only renders its dialogs. Mutation and permission checks remain owned by Workbench.
export function RequestRevisionDialogs(props) {
  const { Dialog, RequestRevisionPanel, Save, Suspense, activeTabId, applyMergedRevision, canEditCloud, conflictDialog, draftsRef, openTabs, reloadCloudConflict, restoreRequestRevision, saveConflictCopy, selectRequestHistoryRevision, setConflictDialog, setVersionDialog, snapshot, versionDialog, workspaceDraft } = props;
  return <>
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
  </>;
}
