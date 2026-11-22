/** Strict request placeholder expansion with bounded recursion. */
export function resolveVars(text, vars, strict = true) {
  const unresolved = new Set();
  const pattern = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}|<<\s*([A-Za-z_][\w]*)\s*>>/g;
  let value = String(text ?? '');
  const seen = new Set();
  for (let depth = 0; depth < 8; depth++) {
    const next = value.replace(pattern, (original, curly, angle) => {
      const key = curly || angle;
      if (!Object.prototype.hasOwnProperty.call(vars, key)) { unresolved.add(key); return original; }
      return String(vars[key] ?? '');
    });
    if (next === value || seen.has(next)) break;
    seen.add(next); value = next;
  }
  for (const match of value.matchAll(pattern)) unresolved.add(match[1] || match[2]);
  if (strict && unresolved.size) throw new Error(`Unresolved environment variable: ${[...unresolved].join(', ')}`);
  return { value, unresolved: [...unresolved] };
}
export function resolveRows(rows, vars) {
  return (rows || []).filter(r=>r?.enabled!==false&&r.key?.trim()).map(r=>({ key: resolveVars(r.key.trim(),vars).value, value: resolveVars(r.value || '', vars).value, ...('file' in r ? {file:r.file}: {}) }));
}
