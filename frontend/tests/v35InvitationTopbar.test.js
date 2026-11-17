import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {isPendingInvitation,canManageInvitation,pendingInvitations} from '../src/features/workspaceInvitations.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=file=>readFileSync(join(root,file),'utf8');
const now=Date.parse('2026-11-16T14:00:00Z');
const active={id:'1',email:'qa@example.com',expiresAt:'2026-11-23T14:00:00Z',roles:['QA'],acceptedAt:null,revokedAt:null};
test('only live unaccepted, unrevoked invitations are pending',()=>{
 assert.equal(isPendingInvitation(active,now),true);
 assert.equal(isPendingInvitation({...active,expiresAt:'2026-11-16T13:00:00Z'},now),false);
 assert.equal(isPendingInvitation({...active,acceptedAt:'2026-11-16T13:30:00Z'},now),false);
 assert.equal(isPendingInvitation({...active,revokedAt:'2026-11-16T13:30:00Z'},now),false);
 assert.equal(isPendingInvitation({...active,expiresAt:'not a timestamp'},now),false);
 assert.deepEqual(pendingInvitations([active,{...active,id:'2',acceptedAt:'2026-11-16T13:30:00Z'}],now).map(x=>x.id),['1']);
});
test('workspace admin cannot resend/revoke privileged-role invitations',()=>{
 assert.equal(canManageInvitation(['WorkspaceAdmin','Developer'],['Developer','QA']),true);
 assert.equal(canManageInvitation(['WorkspaceAdmin'],['TeamLead']),false);
 assert.equal(canManageInvitation(['WorkspaceAdmin'],['WorkspaceAdmin','Developer']),false);
 assert.equal(canManageInvitation(['TeamLead'],['WorkspaceAdmin']),true);
});
test('backend invitation flow is permission-checked and requires Google verification',()=>{
 const source=read('backend/src/Pakpost.Application/Internal/Workspaces/WorkspaceInvitations.cs');
 assert.match(source,/WorkspacePermissions\.MemberManage/);
 assert.match(source,/RoleDelegation\.Check/);
 assert.match(source,/FindByUserProviderAsync\(user\.Id,"google",ct\)/);
 assert.match(source,/FindByTokenHashAsync/);
 assert.match(source,/invitation\.Accept\(DateTimeOffset\.UtcNow\)/);
 assert.match(source,/RandomNumberGenerator\.GetBytes\(32\)/);
 assert.match(source,/SHA256\.HashData/);
 assert.doesNotMatch(source,/return new.*TokenHash/);
});
test('invitation record implements expiry, revoke, rotate and concurrency',()=>{
 const source=read('backend/src/Pakpost.Domain/Entities/WorkspaceInvitation.cs');
 for(const text of ['IsPending','Revoke','Resend','Accept','Version++','AddDays(7)'])assert.ok(source.includes(text));
 assert.match(read('backend/src/Pakpost.Infrastructure/Persistence/Configurations/WorkspaceInvitationConfiguration.cs'),/IsConcurrencyToken/);
});
test('SMTP fails closed when unconfigured and does not return invitation URL as API fallback',()=>{
 const source=read('backend/src/Pakpost.Infrastructure/Services/SmtpWorkspaceInvitationEmailSender.cs');
 assert.match(source,/Email invitations are not configured/);
 assert.match(source,/EnableSsl=true/);
 assert.doesNotMatch(source,/Console\.WriteLine\(.*invitationUrl/);
});
test('frontend exposes Invite, Pending, Resend, Revoke, Accept flows',()=>{
 const src=read('frontend/src/App.jsx');
 for(const phrase of ['Invite via email','Pending invitations','Resend','Revoke','Accept invitation','/api/invitations/accept','/invitations'])assert.ok(src.includes(phrase),phrase);
 assert.match(src,/window\.history\.replaceState/);
 assert.match(src,/googleLinked/);
});
test('final header CSS declares deliberate flex sizes and truncates names',()=>{
 const css=read('frontend/src/v35-invitations-topbar.css');
 for (const phrase of ['.pp-top>.pp-logo','.pp-top>.pp-top-search','.pp-top>.pp-top-right','text-overflow:ellipsis','max-width:calc(100% - 120px)'])assert.ok(css.includes(phrase),phrase);
});
