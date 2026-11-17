// V8.1.4: bounded, session-only metadata and script logs. No HTTP bodies,
// request URLs or authorization headers are captured by the Console itself.
export const CONSOLE_EVENT_LIMIT = 500;
const MAX_MESSAGE_LENGTH = 1200;
let events = [];
const subscribers = new Set();
const notify = () => { for (const fn of subscribers) fn(events); };

const SENSITIVE_KEY = '(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|password|passwd|secret|client[_-]?secret|authorization|cookie|set-cookie|x-api-key)';

// This is best-effort sanitization of *user-authored* console output, NOT a
// guarantee that an arbitrary secret printed without context is detectable.
export function redactConsoleMessage(value) {
  let text = String(value ?? '').slice(0, MAX_MESSAGE_LENGTH);
  text = text.replace(/\bBearer\s+[^\s,'"}]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]');
  text = text.replace(/\b(?:eyJ[A-Za-z0-9_-]{6,}\.){2}[A-Za-z0-9_-]+\b/g, '[JWT REDACTED]');
  text = text.replace(new RegExp(`([?&]${SENSITIVE_KEY}=)[^\\s&#]+`, 'gi'), '$1[REDACTED]');
  // Covers both JSON pairs and key=value / key: value console lines.
  text = text.replace(new RegExp(`(["']?${SENSITIVE_KEY}["']?\\s*[:=]\\s*)(["'])(.*?)\\2`, 'gi'), '$1"[REDACTED]"');
  text = text.replace(new RegExp(`(["']?${SENSITIVE_KEY}["']?\\s*[:=]\\s*)(?!\\[REDACTED\\])[^\\s,}"']+`, 'gi'), '$1[REDACTED]');
  return text;
}

export function scriptConsoleLevel(line) {
  return /^ERROR:\s*/i.test(String(line)) ? 'error'
    : /^WARN:\s*/i.test(String(line)) ? 'warn' : 'log';
}

export function appendConsoleEvent(event) {
  const next = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    executionId: String(event.executionId || ''),
    tabId: String(event.tabId || ''),
    level: ['log','info','warn','error'].includes(event.level) ? event.level : 'info',
    phase: String(event.phase || 'request').slice(0, 40),
    message: redactConsoleMessage(event.message),
    ...Object.fromEntries(['status','elapsedMs','passed','method','transport','errorCode'].filter(key => event[key] !== undefined).map(key => [key,typeof event[key] === 'string' ? redactConsoleMessage(event[key]) : event[key]])),
    // Numeric locations only. Never copy script source into Console events.
    ...(Number.isSafeInteger(event.line) && event.line > 0 ? {line:event.line} : {}),
    ...(Number.isSafeInteger(event.column) && event.column > 0 ? {column:event.column} : {})
  };
  events = [...events, next].slice(-CONSOLE_EVENT_LIMIT);
  notify();
}

export function filterConsoleEvents(source, {level='all',phase='all',execution='all',query=''}={}) {
  const needle=String(query).trim().toLowerCase();
  return source.filter(event=>(level==='all'||event.level===level)
    &&(phase==='all'||event.phase===phase)
    &&(execution==='all'||event.executionId===execution)
    &&(!needle||`${event.message} ${event.phase} ${event.method||''} ${event.status??''} ${event.errorCode||''}`.toLowerCase().includes(needle)));
}

export function formatConsoleEvents(source) {
  return source.map(event=>`${event.timestamp} [${event.executionId.slice(0,8)||'-'}] ${event.level.toUpperCase()} ${event.phase}${event.line?`:${event.line}${event.column?`:${event.column}`:''}`:''}: ${redactConsoleMessage(event.message)}${event.status!==undefined?` · HTTP ${event.status}`:''}${event.elapsedMs!==undefined?` · ${event.elapsedMs} ms`:''}`).join('\n');
}

export function subscribeConsoleEvents(fn) {
  subscribers.add(fn);
  fn(events);
  return () => subscribers.delete(fn);
}
export function clearConsoleEvents() { events=[]; notify(); }
