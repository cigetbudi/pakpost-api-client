import {WORKSPACE_ROLES,normalizeRoles} from './workspaceRoles.js';

// Labels are presentation only. The server-provided member.permissions list
// remains authoritative; do not derive authorization from role names here.
export const WORKSPACE_PERMISSION_GROUPS = [
  {id:'workspace',label:'Workspace',items:[
    {id:'workspace.create',label:'Create workspaces'},
    {id:'workspace.manage',label:'Manage workspace'}]},
  {id:'people',label:'People & teams',items:[
    {id:'member.manage',label:'Manage members'},
    {id:'role.assign',label:'Assign roles'},
    {id:'team.manage',label:'Manage teams'}]},
  {id:'collections',label:'Collections',items:[
    {id:'collection.read',label:'View collections'},
    {id:'collection.write',label:'Edit shared collections'}]},
  {id:'environments',label:'Environments',items:[
    {id:'environment.read',label:'Read environments'},
    {id:'environment.write',label:'Edit shared environments'},
    {id:'environment.secret.read',label:'Read protected secrets'}]},
  {id:'execution',label:'Requests',items:[
    {id:'request.execute',label:'Send API requests'}]},
];

export function groupEffectivePermissions(permissions) {
  const allowed=new Set(Array.isArray(permissions)?permissions:[]);
  const known=new Set(WORKSPACE_PERMISSION_GROUPS.flatMap(group=>group.items.map(item=>item.id)));
  const grouped=WORKSPACE_PERMISSION_GROUPS.map(group=>({
    ...group,
    items:group.items.map(item=>({...item,enabled:allowed.has(item.id)})),
  }));
  const unknown=[...allowed].filter(permission=>!known.has(permission)).sort();
  if(unknown.length)grouped.push({id:'other',label:'Other permissions',items:unknown.map(id=>({id,label:id,enabled:true}))});
  return grouped;
}
export function roleSelectionChanged(before,after) {
  const a=normalizeRoles(before).sort();
  const b=normalizeRoles(after).sort();
  return a.length!==b.length||a.some((item,index)=>item!==b[index]);
}
export function filterWorkspaceMembers(members,{query='',role='all'}={}) {
  const needle=query.trim().toLocaleLowerCase();
  const matches=(members||[]).filter(member=>
    (role==='all'||(member.roles||[]).includes(role)) &&
    (!needle||[member.displayName,member.email].some(value=>String(value||'').toLocaleLowerCase().includes(needle)))
  );
  return matches.sort((a,b)=>String(a.displayName||a.email||'').localeCompare(String(b.displayName||b.email||'')));
}
export function summarizeWorkspaceMembers(members) {
  const list=members||[];
  return {count:list.length,roles:WORKSPACE_ROLES.map(role=>({
    ...role,count:list.filter(member=>(member.roles||[]).includes(role.id)).length,
  }))};
}
