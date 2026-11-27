// Presentation-only composition: state, API calls and mutation stay in App until their controllers are extracted.
// Each dependency is explicit so this component can be tested independently.
export function CollectionDialogs(props) {
  const {
    ArrowDownToLine, Braces, CollectionVariablesEditor, Dialog, DocumentationEditor, FileJson, Suspense,
    applyCollectionVariableSession, canWorkspace, collectionTargetKey, collectionVariablesBusy, collectionVariablesData, collectionVariablesError, collectionVariablesFetchId,
    collectionVariablesLoading, collectionVariablesTarget, confirmExport, docBusy, documentationTarget, exportChoice, exportFormat,
    exportIncludeSecrets, readCollectionVariables, reloadCollectionVariables, resetCollectionVariableSession, saveCollectionVariableDefaults, saveDocumentation, selfMember,
    sessionCollectionVariables, setCollectionVariablesTarget, setDocumentationTarget, setExportChoice, setExportFormat, setExportIncludeSecrets,
    theme,
  } = props;
  return <>
    {documentationTarget&&<Dialog title={`Documentation · ${documentationTarget.type}`} subtitle="Write Markdown notes for OpenAPI/Postman exports." onClose={()=>setDocumentationTarget(null)}><DocumentationEditor key={`${documentationTarget.scope}:${documentationTarget.collectionId}:${documentationTarget.requestId||JSON.stringify(documentationTarget.folderPath||[])}`} title={documentationTarget.name||'Item'} initial={documentationTarget.initial} busy={docBusy} onCancel={()=>setDocumentationTarget(null)} onSave={saveDocumentation}/></Dialog>}
    {exportChoice&&<Dialog title={`Export ${exportChoice.kind}`} subtitle={`Export “${exportChoice.name}” as a downloadable JSON file.`} onClose={()=>setExportChoice(null)}>
      <div className="pp-export-export-options">
        <p>Format</p><div className="pp-export-export-choices">
          <button className={exportFormat==='postman'?'active':''} onClick={()=>setExportFormat('postman')}><FileJson size={17}/><span><strong>Postman JSON</strong><small>{exportChoice.kind==='environment'?'Postman environment':'Postman Collection v2.1'}</small></span></button>
          <button className={exportFormat==='openapi'?'active':''} onClick={()=>setExportFormat('openapi')}><Braces size={17}/><span><strong>OpenAPI 3.1</strong><small>{exportChoice.kind==='environment'?'Vendor-extension environment metadata':'API endpoint description'}</small></span></button>
          <button className={exportFormat==='insomnia'?'active':''} onClick={()=>setExportFormat('insomnia')}><FileJson size={17}/><span><strong>Insomnia v4 JSON</strong><small>Legacy portable format · imports in current Insomnia</small></span></button>
        </div>
        <label className="pp-export-export-secret"><input type="checkbox" checked={exportIncludeSecrets} onChange={e=>setExportIncludeSecrets(e.target.checked)}/> Include secret variable values / known sensitive headers</label>
        {exportIncludeSecrets&&<p className="pp-export-export-warning">The exported JSON may contain credentials. Store it securely.</p>}
        <p className="pp-export-export-note">OpenAPI cannot execute Postman scripts; Insomnia v4 JSON is a legacy interchange format, not Insomnia v5 YAML. Environment OpenAPI export uses an x-pakpost-environment extension. Always check scripts, payloads and examples for credentials; script literals are not automatically redacted.</p>
        <div className="pp-action-dialog-buttons"><button onClick={()=>setExportChoice(null)}>Cancel</button><button className="pp-modal-submit" onClick={confirmExport}><ArrowDownToLine size={15}/> Export JSON</button></div>
      </div>
    </Dialog>}

  </>;
}
