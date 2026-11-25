import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// No writes, no login attempts, no proxy requests, no DB readiness hammering.
const origin = __ENV.BASE_URL || 'http://localhost:8080';
if (!/^https?:\/\/(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(?::\d+)?$/.test(origin)) {
  throw new Error('BASE_URL must be an origin without path, credentials or query');
}
const local = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
if (!local && (!origin.startsWith('https://') || __ENV.ALLOW_REMOTE !== 'YES')) {
  throw new Error('Remote load requires HTTPS and ALLOW_REMOTE=YES');
}
const mode = __ENV.MODE || 'guest';
if (!['guest', 'authenticated'].includes(mode)) throw new Error('Unsupported MODE');
const token = __ENV.PAKPOST_SESSION || '';
if (mode === 'authenticated' && !/^[A-Za-z0-9_-]{43}$/.test(token)) {
  throw new Error('Authenticated mode requires a valid test account session token via environment');
}
const cookieName = local ? 'pakpost_dev_session' : '__Host-pakpost_session';
const bad = new Rate('pakpost_failed_checks');
export const options = {
  scenarios: {
    readonly: {
      executor: 'ramping-vus', startVUs: 0,
      stages: [{ duration: '20s', target: 1 }, { duration: '30s', target: 3 },
        { duration: '30s', target: 5 }, { duration: '10s', target: 0 }],
      gracefulRampDown: '5s', gracefulStop: '5s',
    },
  },
  maxRedirects: 0,
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '20s' }],
    http_req_duration: ['p(95)<1000'],
    pakpost_failed_checks: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '20s' }],
  },
};
function get(path, name, auth = false) {
  return http.get(`${origin}${path}`, {
    redirects: 0, timeout: '5s', tags: { name },
    ...(auth ? { cookies: { [cookieName]: { value: token, replace: true } } } : {}),
  });
}
function parsed(response) { try { return response.json(); } catch (_) { return null; } }
export default function () {
  const live = get('/health/live', 'health-live');
  bad.add(!check(live, { 'liveness healthy': r => r.status === 200 && parsed(r)?.status === 'healthy' }));
  if (mode === 'authenticated') {
    const session = get('/api/auth/session', 'auth-session', true);
    const valid = check(session, { 'session authenticated': r => r.status === 200 && parsed(r)?.authenticated === true });
    bad.add(!valid);
    if (valid) {
      const workspaces = get('/api/workspaces', 'workspace-list', true);
      bad.add(!check(workspaces, { 'workspace list OK': r => r.status === 200 && Array.isArray(parsed(r)) }));
    }
  } else {
    const page = get('/', 'frontend');
    bad.add(!check(page, { 'frontend returns HTML': r => r.status === 200 && (r.headers['Content-Type'] || '').includes('text/html') }));
  }
  sleep(1 + Math.random());
}
