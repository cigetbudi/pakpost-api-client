import test from 'node:test';
import assert from 'node:assert/strict';
import {canRemoveWorkspaceMember} from '../../src/features/workspace/services/workspaceMemberRemoval.js';
const base={canManageMembers:true,workspace:{id:'w',ownerUserId:'founder'},actor:{id:'actor'},actorRoles:['WorkspaceAdmin'],member:{userId:'target',roles:['Developer']}};
test('admin can remove ordinary members only',()=>{
 assert.equal(canRemoveWorkspaceMember(base),true);
 for(const role of ['TeamLead','WorkspaceAdmin'])assert.equal(canRemoveWorkspaceMember({...base,member:{...base.member,roles:['QA',role]}}),false);
});
test('lead can remove privileged members but not founder or self',()=>{
 const lead={...base,actorRoles:['TeamLead']};
 assert.equal(canRemoveWorkspaceMember({...lead,member:{...base.member,roles:['WorkspaceAdmin']}}),true);
 for(const userId of ['founder','actor'])assert.equal(canRemoveWorkspaceMember({...lead,member:{userId,roles:['TeamLead']}}),false);
});
test('missing member.manage or missing workspace/actor hides removal',()=>{
 assert.equal(canRemoveWorkspaceMember({...base,canManageMembers:false}),false);
 assert.equal(canRemoveWorkspaceMember({...base,workspace:null}),false);
 assert.equal(canRemoveWorkspaceMember({...base,actor:null}),false);
});
