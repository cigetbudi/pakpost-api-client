import {Trash2} from 'lucide-react';

/** Confirmation text must match the workspace name exactly before destructive deletion. */
export function WorkspaceDeletionDialog({deleteTarget,deleteConfirmation,deleteBusy,deleteError,
  setDeleteConfirmation,closeDeleteDialog,submitWorkspaceDeletion}) {
  if (!deleteTarget) return null;
  return (

            <div className="pp-workspace-delete-backdrop">
              <section
                className="pp-workspace-delete-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="pp-workspace-delete-title"
                aria-describedby="pp-workspace-delete-description"
              >
                <h3 id="pp-workspace-delete-title">Delete workspace</h3>
                <p id="pp-workspace-delete-description">
                  This permanently deletes <strong>{deleteTarget.name}</strong>, including its
                  collections, nested folders, saved requests, environments,
                  memberships, invitations, and any legacy team data. This cannot be undone.
                </p>
                <form onSubmit={submitWorkspaceDeletion}>
                  <label htmlFor="pp-workspace-delete-confirmation">
                    Type <strong>{deleteTarget.name}</strong> to confirm
                  </label>
                  <input
                    id="pp-workspace-delete-confirmation"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    value={deleteConfirmation}
                    disabled={deleteBusy}
                    onChange={event => setDeleteConfirmation(event.target.value)}
                  />
                  {deleteError && <p role="alert" className="pp-workspace-delete-error">{deleteError}</p>}
                  <div className="pp-workspace-delete-actions">
                    <button type="button" onClick={closeDeleteDialog} disabled={deleteBusy}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="danger"
                      disabled={deleteBusy || deleteConfirmation !== deleteTarget.name}
                    >
                      <Trash2 size={14}/>
                      {deleteBusy ? 'Deleting…' : 'Delete permanently'}
                    </button>
                  </div>
                </form>
              </section>
            </div>

  );
}
