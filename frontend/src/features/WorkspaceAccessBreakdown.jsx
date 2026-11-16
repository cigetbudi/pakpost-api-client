import React from 'react';
import {Check,LockKeyhole} from 'lucide-react';
import {groupEffectivePermissions} from './workspaceRoleInsights.js';

export function WorkspaceAccessBreakdown({permissions=[]}){
  const groups=groupEffectivePermissions(permissions);
  return <section className="pp-v34-access" aria-label="Effective permissions">
    <div className="pp-v34-access-heading"><strong>Effective permissions</strong><span>From PakPost backend · this workspace only</span></div>
    <div className="pp-v34-access-grid">
      {groups.map(group=><div className="pp-v34-access-group" key={group.id}>
        <strong>{group.label}</strong>
        {group.items.map(permission=><div key={permission.id} className={`pp-v34-access-item ${permission.enabled?'is-allowed':'is-denied'}`}>
          {permission.enabled?<Check size={13}/>:<LockKeyhole size={12}/>}
          <span>{permission.label}</span>
        </div>)}
      </div>)}
    </div>
    <p>Permissions above are read from the saved membership. Unsaved role changes do not affect access until the backend accepts them.</p>
  </section>;
}
