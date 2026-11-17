/** Convert QuickJS wrapper stacks into locations in the user's original script.
 * No source maps, network calls or extra parser dependencies are required.
 */
const SCRIPT_FILENAME = 'pakpost-script.js';
const MAX_MESSAGE = 500;

export function scriptDiagnostic(fault, {phase='pre', code='', sourceStartLine=1}={}) {
  const error = typeof fault === 'object' && fault !== null ? fault : {stack:String(fault ?? '')};
  const stack = String(error.stack ?? '');
  const first = stack.split('\n').find(line => line.trim() && !/^\s*at\s/.test(line))?.trim() || '';
  const rawName = String(error.name || (first.match(/^([A-Za-z]*Error):/)?.[1]) || 'Error');
  const name = /^[A-Za-z]*Error$/.test(rawName) ? rawName : 'Error';
  let message = String(error.message || first.replace(/^[A-Za-z]*Error:\s*/, '') || 'Script execution failed').trim();
  // QuickJS sometimes returns only stack frames (no error name/message).
  if (/^at\s|^\(?(?:eval|pakpost-script)\.js:\d+/.test(message)) message = 'Script execution failed';
  message = message.slice(0, MAX_MESSAGE);

  const lineCount = String(code).split('\n').length;
  const min = sourceStartLine;
  const max = sourceStartLine + lineCount - 1;
  const frames = [...stack.matchAll(/(?:pakpost-script|eval)\.js:(\d+)(?::(\d+))?/g)];
  const frame = frames.find(match => Number(match[1]) >= min && Number(match[1]) <= max);
  const line = frame ? Number(frame[1]) - min + 1 : null;
  const sourceLine = line ? String(code).split('\n')[line-1] || '' : '';
  const column = line && frame[2] ? Math.min(Math.max(1, Number(frame[2])), sourceLine.length + 1) : null;

  return {phase:phase === 'post'?'post':'pre', kind:name === 'SyntaxError'?'syntax':'runtime',
    name, message, line, column};
}

export function formatScriptDiagnostic(issue) {
  const where = issue.line ? ` (line ${issue.line}${issue.column ? `, column ${issue.column}` : ''})` : '';
  return `${issue.name}: ${issue.message}${where}`;
}
