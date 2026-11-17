import React from 'react';
import {Check,LockKeyhole} from 'lucide-react';
import {groupEffectivePermissions} from '../services/workspaceRoleInsights.js';

export function WorkspaceAccessBreakdown({permissions=[]}){
  const groups=groupEffectivePermissions(permissions);
  return <section className="pp-roles-access" aria-label="Effective permissions">
    <div className="pp-roles-access-heading"><strong>Effective permissions</strong><span>From PakPost backend · this workspace only</span></div>
    <div className="pp-roles-access-grid">
      {groups.map(group=><div className="pp-roles-access-group" key={group.id}>
        <strong>{group.label}</strong>
        {group.items.map(permission=><div key={permission.id} className={`pp-roles-access-item ${permission.enabled?'is-allowed':'is-denied'}`}>
          {permission.enabled?<Check size={13}/>:<LockKeyhole size={12}/>}
          <span>{permission.label}</span>
        </div>)}
      </div>)}
    </div>
    <p>Permissions above are read from the saved membership. Unsaved role changes do not affect access until the backend accepts them.</p>
  </section>;
}
