import {validWorkspaceMemberJoined} from '../../realtime/services/workspaceEventPolicy.js';

/** Serialize membership refreshes and suppress duplicates for the current session.
 * A hub event is only a hint; permission-checked HTTP data is authoritative. */
export function queueWorkspaceMemberJoined(scope,event,{isCurrent,fetchMembers,version,commit,currentUserId,notify}){
  if(!scope?.enabled||!scope.token||!validWorkspaceMemberJoined(event,scope.workspaceId)||scope.seen.has(event.eventId))return;
  scope.seen.add(event.eventId);
  if(scope.seen.size>256)scope.seen.delete(scope.seen.values().next().value);
  scope.queue=scope.queue.then(async()=>{
    if(!isCurrent())return;
    const before=version.current;
    const data=await fetchMembers();
    if(!isCurrent()||version.current!==before)return;
    if(!Array.isArray(data))throw Error('Invalid members response');
    version.current++;
    commit(data);
    const member=data.find(item=>item.userId===event.userId);
    if(!event.removed&&member&&member.userId!==currentUserId())notify(`${member.displayName||'A new member'} has joined the workspace`);
  }).catch(()=>{scope.seen.delete(event.eventId);});
  return scope.queue;
}
