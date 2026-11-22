import React from 'react';
import { Layers3, ArrowRight, Plus, ChevronRight, FolderClosed, LockKeyhole, ShieldCheck, FolderPlus, Trash2 } from 'lucide-react';
import { api } from '../../../services/httpClient.js';
import { IconButton, Empty } from '../../../components/ui/WorkbenchPrimitives.jsx';
import { WorkspaceMembersSection } from './WorkspaceMembersSection.jsx';
import { WorkspaceDeletionDialog } from './WorkspaceDeletionDialog.jsx';
import { pendingInvitations } from '../services/workspaceInvitations.js';

// Workspace is intentionally a separate view. It has no access to request
// drafts or authentication secrets; all mutations still use the same API/RBAC.
export function WorkspaceManager({ data, actions, refs }) {
  const {activeWorkspace,workspaces,canCreateWorkspace,newWs,token,busyAction,
    selectedWs,wsTab,canEditCloud,newCollection,collections,selectedCol,savedRequests,
    workspaceMemberStats,invitationRows,me} = data;
  const {setPage,doAction,setNewWs,loadWorkspaces,setSelectedWs,setNotice,
    setWsTab,setNewCollection,setCollections,setSelectedCol,loadSavedRequest,setSavedRequests} = actions;
  const {currentTokenRef} = refs;
  const [maxSeats, setMaxSeats] = React.useState(null);
  React.useEffect(() => {
    if (!token) { setMaxSeats(null); return; }
    let active = true;
    api('/api/workspaces/capabilities', 'GET', undefined, token)
      .then(cap => { if (active) setMaxSeats(Number.isInteger(cap.maxMembersPerWorkspace) ? cap.maxMembersPerWorkspace : null); })
      .catch(() => { if (active) setMaxSeats(null); });
    return () => { active = false; };
  }, [token]);
  const reservedSeats = workspaceMemberStats.count + pendingInvitations(invitationRows).length;
  const atCapacity = maxSeats !== null && reservedSeats >= maxSeats;
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');
  const isFounder = activeWorkspace?.ownerUserId === me?.id;
  // Older clients may retain a Teams selection during a hot reload.
  const activeWsTab = wsTab === 'members' ? 'members' : 'collections';

  const closeDeleteDialog = () => {
    if (deleteBusy) return;

    setDeleteTarget(null);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  const submitWorkspaceDeletion = async event => {
    event.preventDefault();

    if (
      deleteBusy ||
      !deleteTarget ||
      deleteConfirmation !== deleteTarget.name ||
      deleteTarget.ownerUserId !== me?.id
    ) {
      return;
    }

    setDeleteBusy(true);
    setDeleteError('');

    try {
      const workspaceId = deleteTarget.id;

      await api(`/api/workspaces/${workspaceId}`, 'DELETE', undefined, token);
      closeDeleteDialogAfterSuccess();
      setSelectedWs(current => current === workspaceId ? '' : current);
      await loadWorkspaces(token);

      if (currentTokenRef.current === token) {
        setNotice('Workspace permanently deleted.');
      }
    } catch (error) {
      setDeleteError(error?.message || 'Could not delete workspace.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const closeDeleteDialogAfterSuccess = () => {
    setDeleteTarget(null);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  return (
<div className="pp-manager">
          <div className="pp-manager-top"><div><span className="pp-manager-eyebrow"><Layers3 size={14}/> WORKSPACE MANAGEMENT</span><h2>{activeWorkspace?.name || 'Your workspaces'}</h2><p>Manage shared collections, workspace members, and access roles after sign-in.</p></div><button className="pp-plain-btn" onClick={() => setPage('tester')}><ArrowRight size={15}/> Back to request tester</button></div>
          <div className="pp-manager-columns"><aside className="pp-manager-ws"><div className="pp-manager-label">YOUR WORKSPACES <span>{workspaces.length}</span></div>{!canCreateWorkspace&&<p className="pp-muted-small" style={{padding:'0 10px'}}>Workspace creation requires instance admin approval.</p>}{canCreateWorkspace&&<form className="pp-manager-add" onSubmit={e => { e.preventDefault(); if(!newWs.trim()) return; doAction(async()=>{const w=await api('/api/workspaces','POST',{name:newWs.trim()},token);setNewWs('');await loadWorkspaces();setSelectedWs(w.id);setNotice('Workspace created.');}); }}><input placeholder="New workspace" maxLength={120} value={newWs} onChange={e=>setNewWs(e.target.value)}/><button title="Create workspace" disabled={busyAction}><Plus size={16}/></button></form>}{workspaces.map(w=><button className={`pp-manager-ws-row ${w.id === selectedWs ? 'active' : ''}`} key={w.id} onClick={()=>setSelectedWs(w.id)}><Layers3 size={17}/><span>{w.name}</span><ChevronRight size={15}/></button>)}</aside>
            <section className="pp-manager-details">{!activeWorkspace ? <Empty icon={FolderClosed} title="No workspace selected" description={canCreateWorkspace ? "Create a workspace on the left to start organizing your requests." : "Ask your instance administrator to enable Workspace Creator for your account."}/> : <>
              <div className="pp-manager-detail-title">
                <span className="pp-manager-avatar"><Layers3 size={18}/></span>
                <div><strong>{activeWorkspace.name}</strong><small>Private · Members only</small></div>
                <div className="pp-workspace-title-actions">
                  {isFounder && (
                    <button
                      type="button"
                      className="pp-workspace-delete-trigger"
                      disabled={busyAction}
                      onClick={() => {
                        setDeleteTarget(activeWorkspace);
                        setDeleteConfirmation('');
                        setDeleteError('');
                      }}
                    >
                      <Trash2 size={14}/>
                      Delete workspace
                    </button>
                  )}
                  <LockKeyhole size={15}/>
                </div>
              </div>
              <div className="pp-manager-tabs">{[['collections','Collections',FolderClosed],['members','Members & Roles',ShieldCheck]].map(([id,label,Icon])=><button className={activeWsTab === id ? 'active':''} key={id} onClick={()=>setWsTab(id)}><Icon size={15}/>{label}</button>)}</div>
              {activeWsTab === 'collections' && <div className="pp-manager-section"><div className="pp-manager-section-heading"><strong>Collections</strong>{canEditCloud&&<form className="pp-manager-add" onSubmit={e=>{e.preventDefault();if(!newCollection.trim())return;doAction(async()=>{await api(`/api/workspaces/${selectedWs}/collections`,'POST',{name:newCollection.trim()},token);setNewCollection('');setCollections(await api(`/api/workspaces/${selectedWs}/collections`,'GET',undefined,token));setNotice('Collection created');});}}><input placeholder="Collection name" maxLength={120} value={newCollection} onChange={e=>setNewCollection(e.target.value)}/><button title="Create collection" disabled={busyAction}><Plus size={16}/></button></form>}</div>{collections.map(c=><button className={`pp-manager-entry ${selectedCol === c.id ? 'active' : ''}`} key={c.id} onClick={()=>setSelectedCol(c.id)}><FolderClosed size={16}/><span>{c.name}</span><ChevronRight size={15}/></button>)}{!collections.length && <Empty icon={FolderPlus} title="No collections yet" description="Create your first collection above."/>}{selectedCol && <div className="pp-manager-saved"><h3>Saved requests</h3>{savedRequests.map(r=><div className="pp-manager-saved-row" key={r.id}><span className={`pp-http-label ${r.method.toLowerCase()}`}>{r.method}</span><button onClick={()=>loadSavedRequest(r)}><strong>{r.name}</strong><small>{r.url}</small></button>{canEditCloud&&<IconButton icon={Trash2} label="Delete request" disabled={busyAction} onClick={()=>doAction(async()=>{await api(`/api/workspaces/${selectedWs}/collections/${selectedCol}/requests/${r.id}`,'DELETE',undefined,token);setSavedRequests(v=>v.filter(x=>x.id!==r.id));})}/>}</div>)}{!savedRequests.length && <p className="pp-muted-small">No saved requests in this collection.</p>}</div>}</div>}
              {activeWsTab === 'members' && <WorkspaceMembersSection data={data} actions={actions} refs={refs} maxSeats={maxSeats} reservedSeats={reservedSeats} atCapacity={atCapacity}/>}
            </>}</section></div>
          <WorkspaceDeletionDialog deleteTarget={deleteTarget} deleteConfirmation={deleteConfirmation}
            deleteBusy={deleteBusy} deleteError={deleteError} setDeleteConfirmation={setDeleteConfirmation}
            closeDeleteDialog={closeDeleteDialog} submitWorkspaceDeletion={submitWorkspaceDeletion}/>

        </div>
  );
}
