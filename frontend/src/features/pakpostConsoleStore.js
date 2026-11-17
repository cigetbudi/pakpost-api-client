// V8.1: in-memory only; no request/response body, auth headers, or Cloud persistence.
const LIMIT = 500;
let events = [];
const subscribers = new Set();
const notify = () => { for (const fn of subscribers) fn(events); };

// Best-effort redaction for script console strings. Never treat this as a
// substitute for not logging secrets in the first place.
export function redactConsoleMessage(value) {
  let text = String(value ?? '').slice(0, 1200);
  text = text.replace(/\bBearer\s+[^\s,'"}]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/\b(Basic)\s+[A-Za-z0-9+/=]+/gi, '$1 [REDACTED]');
  text = text.replace(/\b(?:eyJ[A-Za-z0-9_-]{6,}\.){2}[A-Za-z0-9_-]+\b/g, '[JWT REDACTED]');
  text = text.replace(/([?&](?:access_token|refresh_token|token|api[_-]?key|password|secret|authorization)=)[^\s&#]+/gi, '$1[REDACTED]');
  text = text.replace(/(["']?(?:access_token|refresh_token|token|api[_-]?key|password|secret|authorization|client_secret)["']?\s*[:=]\s*["']?)[^\s,}"']+/gi, '$1[REDACTED]');
  return text;
}
export function appendConsoleEvent(event) {
  const next = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    executionId: String(event.executionId||''),
    tabId: String(event.tabId||''),
    level: ['log','info','warn','error'].includes(event.level)?event.level:'info',
    phase: String(event.phase||'request').slice(0,40),
    message: redactConsoleMessage(event.message),
    ...Object.fromEntries(['status','elapsedMs','passed','method','transport','errorCode'].filter(key => event[key] !== undefined).map(key=>[key,typeof event[key] === 'string' ? redactConsoleMessage(event[key]) : event[key]]))
  };
  events = [...events, next].slice(-LIMIT);
  notify();
}
export function subscribeConsoleEvents(fn) {
  subscribers.add(fn);
  fn(events);
  return () => subscribers.delete(fn);
}
export function clearConsoleEvents() { events=[]; notify(); }
