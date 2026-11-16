import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORKSPACE_PERMISSION_GROUPS,filterWorkspaceMembers,groupEffectivePermissions,roleSelectionChanged,summarizeWorkspaceMembers} from '../src/features/workspaceRoleInsights.js';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const members=[
  {userId:'a',displayName:'Riska Dev',email:'Riska@corp.test',roles:['Developer','WorkspaceAdmin'],permissions:['collection.read','collection.write','member.manage']},
  {userId:'b',displayName:'Bayu QA',email:'bayu@corp.test',roles:['QA'],permissions:['collection.read','request.execute']},
  {userId:'c',displayName:'Tina QA',email:'tina@corp.test',roles:['QA','TechnicalWriter'],permissions:['collection.read','request.execute']},
];
test('Workspace member search matches name/email case insensitively and filters roles',()=>{
  assert.deepEqual(filterWorkspaceMembers(members,{query:'CORP.TEST',role:'Developer'}).map(m=>m.userId),['a']);
  assert.deepEqual(filterWorkspaceMembers(members,{query:'QA',role:'QA'}).map(m=>m.userId),['b','c']);
  assert.deepEqual(filterWorkspaceMembers(members,{query:'Nobody'}),[]);
  assert.equal(members.length,3);
});
test('Role stats count every membership without double-counting users',()=>{
  const stats=summarizeWorkspaceMembers(members);
  assert.equal(stats.count,3);
  assert.equal(stats.roles.find(r=>r.id==='QA').count,2);
  assert.equal(stats.roles.find(r=>r.id==='WorkspaceAdmin').count,1);
  assert.equal(stats.roles.find(r=>r.id==='TechnicalWriter').count,1);
});
test('Role save detection ignores order and duplicate roles',()=>{
  assert.equal(roleSelectionChanged(['Developer','QA'],['QA','Developer','QA']),false);
  assert.equal(roleSelectionChanged(['QA'],['TechnicalWriter']),true);
  assert.equal(roleSelectionChanged([],[]),false);
});
test('Effective permission display relies on backend permissions, not role labels',()=>{
  const groups=groupEffectivePermissions(['request.execute','collection.read','future.permission']);
  assert.equal(groups.find(g=>g.id==='collections').items.find(p=>p.id==='collection.write').enabled,false);
  assert.equal(groups.find(g=>g.id==='execution').items[0].enabled,true);
  assert.deepEqual(groups.find(g=>g.id==='other').items.map(p=>p.id),['future.permission']);
  assert.equal(WORKSPACE_PERMISSION_GROUPS.some(g=>g.items.some(p=>p.id==='environment.secret.read')),true);
});
test('UI shows backend effective permissions and preserves server-side role assignment',()=>{
  const app=source('src/App.jsx');
  const access=source('src/features/WorkspaceAccessBreakdown.jsx');
  assert.match(app,/WorkspaceAccessBreakdown permissions=\{m\.permissions\|\|\[\]\}/);
  assert.match(access,/From PakPost backend/);
  assert.match(app,/members\/\$\{m\.userId\}\/roles/);
  assert.match(app,/canAssignRoles&&!founder&&!self/);
  assert.match(app,/roleSelectionChanged\(m\.roles,editingMemberRoles\)/);
  assert.match(app,/selectedWorkspaceRef\.current/);
});
