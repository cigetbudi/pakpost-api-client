// Only renders its dialogs. Mutation and permission checks remain owned by Workbench.
export function UnsavedChangesDialog(props) {
  const { Dialog, closeConfirmation, collections, openTabs, performTabAction, setCloseConfirmation } = props;
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
  </>;
}
