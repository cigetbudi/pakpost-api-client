import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Server, Database } from 'lucide-react';

async function inspect(url, options = {}) {
  try {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json().catch(() => null);
    return { reachable: true, ok: response.ok, status: response.status, data };
  } catch {
    return { reachable: false, ok: false, status: 0, data: null };
  }
}

function HealthItem({ icon: Icon, label, state, detail }) {
  const healthy = state === 'healthy';
  const unavailable = state === 'unavailable';
  return <div className="pp-system-health-item">
    <div className="pp-system-health-label"><Icon size={18}/><span><strong>{label}</strong>{detail&&<small>{detail}</small>}</span></div>
    <span className={`pp-system-health-state ${healthy?'healthy':unavailable?'unavailable':'unknown'}`}>
      {healthy?<CheckCircle2 size={14}/>:unavailable?<AlertTriangle size={14}/>:<Activity size={14}/>}
      {healthy?'Healthy':unavailable?'Unavailable':'Unknown'}
    </span>
  </div>;
}

export function SystemHealthPanel({ token = '' }) {
  const [health, setHealth] = useState({ checking: true, api: 'unknown', database: 'unknown', latencyMs: null });
  const activeCheck = useRef(null);

  const refresh = useCallback(async () => {
    activeCheck.current?.abort();
    const controller = new AbortController();
    activeCheck.current = controller;
    const { signal } = controller;
    setHealth(previous => ({ ...previous, checking: true }));
    const [live, ready, detail] = await Promise.all([
      inspect('/health/live', { signal }),
      inspect('/health/ready', { signal }),
      token ? inspect('/api/system/health', { signal }) : Promise.resolve(null)
    ]);

    if (signal.aborted) return;
    const api = live.ok ? 'healthy' : 'unavailable';
    const database = ready.ok ? 'healthy' : ready.status === 503 ? 'unavailable' : 'unknown';
    const latencyMs = detail?.data?.database?.latencyMs;

    setHealth({
      checking: false,
      api,
      database,
      latencyMs: typeof latencyMs === 'number' && Number.isFinite(latencyMs) ? latencyMs : null,
      checkedAt: new Date().toLocaleTimeString()
    });
  }, [token]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => { clearInterval(interval); activeCheck.current?.abort(); };
  }, [refresh]);

  return <div className="pp-system-health">
    <div className="pp-system-health-heading">
      <div><h2>System Health</h2><p>Live readiness checks for the PakPost API and PostgreSQL. No database credentials are exposed.</p></div>
      <button type="button" className="pp-system-health-refresh" onClick={refresh} disabled={health.checking}>
        <RefreshCw size={14} className={health.checking?'pp-system-health-spinning':''}/> Refresh
      </button>
    </div>
    <div className="pp-system-health-items" role="status" aria-live="polite">
      <HealthItem icon={Server} label="Backend API" state={health.api} detail="/health/live"/>
      <HealthItem icon={Database} label="PostgreSQL / NeonDB" state={health.database} detail="/health/ready"/>
    </div>
    <div className="pp-system-health-foot">
      <span>Database latency: <strong>{health.latencyMs === null ? token ? 'Unavailable' : 'Sign in to view' : `${health.latencyMs} ms`}</strong></span>
      <span>{health.checkedAt ? `Last checked ${health.checkedAt}` : 'Checking…'}</span>
    </div>
    <p className="pp-system-health-help">Checks refresh every 30 seconds while this panel is open. A degraded database does not necessarily mean the API process is down.</p>
  </div>;
}
