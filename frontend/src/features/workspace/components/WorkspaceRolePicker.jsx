import React from 'react';
import {WORKSPACE_ROLES,canGrantRole} from '../services/workspaceRoles.js';
export function WorkspaceRolePicker({value=[],onChange,actorRoles=[],disabled=false}){
  return <div className="pp-rbac-role-grid" role="group" aria-label="Workspace roles">
    {WORKSPACE_ROLES.map(role=>{
      const granted=canGrantRole(actorRoles,role.id);
      const checked=value.includes(role.id);
      return <label key={role.id} className={`pp-rbac-role ${checked?'is-checked':''} ${!granted?'is-locked':''}`} title={!granted?'Only a Team Lead can assign this role':role.description}>
        <input type="checkbox" checked={checked} disabled={disabled||!granted}
          onChange={event=>onChange(event.target.checked?[...value,role.id]:value.filter(x=>x!==role.id))}/>
        <span><strong>{role.label}</strong><small>{role.description}</small></span>
      </label>;
    })}
  </div>;
}
