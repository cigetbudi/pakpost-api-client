export const WORKSPACE_ROLES = [
  { id:'TeamLead', label:'Team Lead', description:'Full workspace control' },
  { id:'WorkspaceAdmin', label:'Workspace Admin', description:'Manage workspace and members' },
  { id:'Developer', label:'Developer', description:'Create, edit and save shared requests' },
  { id:'QA', label:'QA / Tester', description:'Read and test; no Cloud save' },
  { id:'TechnicalWriter', label:'Technical Writer', description:'Read and test; no Cloud save' },
];
export const PRIVILEGED_ROLES = ['TeamLead','WorkspaceAdmin'];
export function canGrantRole(actorRoles, candidate) {
  return actorRoles.includes('TeamLead') || !PRIVILEGED_ROLES.includes(candidate);
}
export function normalizeRoles(roles) {
  const ids=new Set(WORKSPACE_ROLES.map(r=>r.id));
  return [...new Set((roles||[]).filter(r=>ids.has(r)))];
}
export function currentWorkspaceMember(members,me) {
  return (members||[]).find(m=>m.userId===me?.id)||null;
}
export function canWorkspace(member,permission) {
  return Boolean(member?.permissions?.includes(permission));
}
