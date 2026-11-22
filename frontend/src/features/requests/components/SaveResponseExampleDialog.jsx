// Only renders its dialogs. Mutation and permission checks remain owned by Workbench.
export function SaveResponseExampleDialog(props) {
  const { Dialog, Save, activeSource, activeTabId, busyAction, canEditCloud, exampleDescription, exampleName, isReadOnlyCloudTab, openTabs, result, saveExampleOpen, saveResponseExample, selectedWs, setExampleDescription, setExampleName, setSaveExampleOpen, statusTone } = props;
  return <>
    {saveExampleOpen && <Dialog title="Save response example" subtitle="Capture the latest response as an example for this request." onClose={()=>setSaveExampleOpen(false)}><form className="modal-form" onSubmit={saveResponseExample}>
      <label>Example name<input autoFocus required maxLength={140} value={exampleName} onChange={e=>setExampleName(e.target.value)}/></label>
      <label>Description <textarea rows={3} maxLength={1000} placeholder="Optional note, e.g. when to expect this response" value={exampleDescription} onChange={e=>setExampleDescription(e.target.value)}/></label>
      <p className="pp-example-warning">Review the response body before saving. It can contain personal data, tokens, or account details. Known sensitive response headers are redacted; the body is saved as-is (up to 64 KB). {isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabId),canEditCloud,selectedWs)?'Sandbox only: this example is not saved to Cloud and is lost when you close or refresh the session.':(!activeSource()||activeSource()?.pending?'This is a draft; use Save to keep this example in a collection.':'')}</p>
      {result && !result.error && <div className="pp-example-preview"><span className={`pp-example-status ${statusTone(result.statusCode)}`}>{result.statusCode}</span><strong>{result.reasonPhrase || 'HTTP response'}</strong><small>{new Blob([result.body || '']).size.toLocaleString()} B · {result.elapsedMs} ms</small></div>}
      <button className="pp-modal-submit" type="submit" disabled={!result||!!result.error||busyAction}><Save size={16}/> Save example</button>
    </form></Dialog>}
  </>;
}
