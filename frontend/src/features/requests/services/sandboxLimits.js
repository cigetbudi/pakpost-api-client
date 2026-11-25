// Limits on the host/guest boundary, independent of QuickJS memory and CPU limits.
export const SANDBOX_LIMITS = Object.freeze({ code: 256 * 1024, input: 12 * 1024 * 1024, output: 8 * 1024 * 1024, records: 500, line: 8192 });
const bytes = value => new TextEncoder().encode(value).byteLength;
export function boundedScriptJson(value, limit, label) {
  const json = JSON.stringify(value);
  if (typeof json !== 'string' || json.length > limit || bytes(json) > limit) throw new Error(`${label} exceeds sandbox size limit.`);
  return json;
}
export function validateScriptInput(input) {
  if (typeof input.code !== 'string' || input.code.length > SANDBOX_LIMITS.code || bytes(input.code) > SANDBOX_LIMITS.code) throw new Error('Script exceeds sandbox source size limit.');
  boundedScriptJson(input, SANDBOX_LIMITS.input, 'Script input');
}
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const reserved = new Set(['__proto__', 'prototype', 'constructor']);
export function parseScriptOutput(json) {
  if (typeof json !== 'string' || json.length > SANDBOX_LIMITS.output || bytes(json) > SANDBOX_LIMITS.output) throw new Error('Script output exceeds sandbox size limit.');
  const data = JSON.parse(json);
  if (!isRecord(data)) throw new Error('Invalid script output.');
  for (const key of ['variables','environmentVariables','collectionVariables','localVariables','requestHeaderOverrides']) {
    if (!isRecord(data[key]) || Object.keys(data[key]).some(name => reserved.has(name))) throw new Error('Invalid or reserved script variable/header key.');
  }
  if (!Array.isArray(data.logs) || data.logs.length > SANDBOX_LIMITS.records || data.logs.some(line => typeof line !== 'string' || line.length > SANDBOX_LIMITS.line)) throw new Error('Script log limit exceeded.');
  if (!Array.isArray(data.tests) || data.tests.length > SANDBOX_LIMITS.records || data.tests.some(t => !isRecord(t) || typeof t.name !== 'string' || t.name.length > SANDBOX_LIMITS.line || typeof t.passed !== 'boolean' || (t.error !== undefined && (typeof t.error !== 'string' || t.error.length > SANDBOX_LIMITS.line)))) throw new Error('Script assertion limit exceeded.');
  if (data.scriptFault != null && (!isRecord(data.scriptFault) || ['name','message','stack'].some(key=>typeof data.scriptFault[key] !== 'string' || data.scriptFault[key].length > SANDBOX_LIMITS.line))) throw new Error('Invalid script diagnostic.');
  return data;
}
