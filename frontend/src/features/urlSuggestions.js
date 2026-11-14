// URL syntax hints use the selected environment, never contact a server.
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
export function splitUrlVariables(url, variables = {}) {
  const text = String(url ?? '');
  const parts = [];
  const pattern = /\{\{([^{}]*)\}\}/g;
  let offset = 0;
  for (const found of text.matchAll(pattern)) {
    if (found.index > offset) parts.push({ text: text.slice(offset, found.index), type: 'plain' });
    const key = found[1].trim();
    const defined = NAME.test(key) && Object.prototype.hasOwnProperty.call(variables, key);
    parts.push({ text: found[0], key, type: defined ? 'known' : 'missing' });
    offset = found.index + found[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), type: 'plain' });
  return parts;
}
export function currentVariablePrefix(url, cursor) {
  const text = String(url ?? '');
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > text.length) return null;
  const before = text.slice(0, cursor);
  const found = /\{\{([A-Za-z_][A-Za-z0-9_]*|)$/.exec(before);
  if (!found) return null;
  return { query: found[1], start: cursor - found[0].length, cursor };
}
export function suggestVariables(url, cursor, variables = {}) {
  const match = currentVariablePrefix(url, cursor);
  if (!match) return [];
  return Object.keys(variables)
    .filter(k => NAME.test(k) && k.toLowerCase().startsWith(match.query.toLowerCase()))
    .sort((a,b) => a.localeCompare(b))
    .slice(0, 8);
}
export function insertVariable(url, cursor, name) {
  const current = currentVariablePrefix(url, cursor);
  if (!current || !NAME.test(name)) return null;
  const next = String(url);
  // Respect an already typed closing pair rather than producing }}}}.
  const closing = next.slice(cursor).startsWith('}}') ? '' : '}}';
  const inserted = `{{${name}${closing}`;
  return { url: next.slice(0, current.start) + inserted + next.slice(cursor), cursor: current.start + inserted.length };
}
