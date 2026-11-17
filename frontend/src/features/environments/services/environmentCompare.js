import {isSensitiveVariable} from './variableExperience.js';

const MAX_RENDER_VALUE = 320;
const MASK = '••••••';
const PLACEHOLDER = '(empty)';

/**
 * Compare the two *already loaded* environments in the selected Local or Cloud
 * workspace context. This module never stores, exports or logs source values.
 * No name convention is assumed: keys are matched exactly and case-sensitively.
 */
export function compareEnvironments(left, right) {
  const index = environment => new Map((environment?.variables || [])
    .filter(variable => variable && typeof variable.key === 'string' && variable.key.trim())
    .map(variable => [variable.key, variable]));
  const a = index(left), b = index(right);
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort((x,y)=>x.localeCompare(y));
  const totals = {matched:0,different:0,onlyLeft:0,onlyRight:0,protected:0};
  const rows = keys.map(key => {
    const lhs = a.get(key), rhs = b.get(key);
    const sensitive = isSensitiveVariable(key,lhs) || isSensitiveVariable(key,rhs);
    const restricted = Boolean(lhs?.isRedacted || rhs?.isRedacted ||
      (sensitive && (lhs?.value === '[REDACTED]' || rhs?.value === '[REDACTED]')));
    let status;
    if (!lhs) status = 'onlyRight';
    else if (!rhs) status = 'onlyLeft';
    else if (restricted) status = 'protected';
    else status = String(lhs.value ?? '') === String(rhs.value ?? '') ? 'matched' : 'different';
    totals[status]++;
    // Only safe display strings enter the result. Never return raw secret values.
    const displayValue = variable => {
      if (!variable) return '—';
      if (variable.isRedacted || restricted) return 'Restricted';
      if (sensitive) return MASK;
      const raw = String(variable.value ?? '');
      return raw.length ? (raw.length > MAX_RENDER_VALUE ? `${raw.slice(0,MAX_RENDER_VALUE)}…` : raw) : PLACEHOLDER;
    };
    return {key,status,sensitive,restricted,left:displayValue(lhs),right:displayValue(rhs),
      leftExists:!!lhs,rightExists:!!rhs};
  });
  return {rows,totals,total:rows.length};
}

export function filterEnvironmentCompare(rows,{query='',status='all',onlyChanges=false}={}) {
  const needle=String(query).trim().toLocaleLowerCase();
  return rows.filter(row=>(status==='all'||row.status===status) && (!onlyChanges || row.status!=='matched') &&
    (!needle || row.key.toLocaleLowerCase().includes(needle)));
}
