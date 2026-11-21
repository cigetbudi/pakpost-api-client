import React,{useCallback,useEffect,useState} from 'react';
import {ShieldCheck,Monitor,Smartphone,RefreshCw,LogOut,AlertTriangle,Clock3} from 'lucide-react';
import {api} from '../../../services/httpClient.js';

function describeAgent(raw='') {
  const ua=String(raw||'');
  const browser=/Firefox\//.test(ua)?'Firefox':/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Browser';
  const os=/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Windows/.test(ua)?'Windows':/Macintosh/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Unknown device';
  return {name:`${browser} · ${os}`,mobile:os==='Android'||os==='iOS'};
}
function formatDate(value){
  if(!value)return '—';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'—':date.toLocaleString();
}

export function AccountSecurityPanel({token}) {
  const [sessions,setSessions]=useState([]),[loading,setLoading]=useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  const [confirm,setConfirm]=useState(null),[busy,setBusy]=useState(false);
  const refresh=useCallback(async(signal)=>{
    setLoading(true);setError('');
    try {
      const data=await api('/api/auth/sessions','GET',undefined,token,signal?{signal}:{});
      if(!signal?.aborted)setSessions(Array.isArray(data)?data:[]);
    } catch(e){if(!signal?.aborted)setError(e?.message||'Unable to load sessions');}
    finally{if(!signal?.aborted)setLoading(false);}
  },[token]);
  useEffect(()=>{
    if(!token){setSessions([]);return;}
    const controller=new AbortController();
    refresh(controller.signal);
    return()=>controller.abort();
  },[token,refresh]);
  async function revoke(){
    if(!confirm||busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      if(confirm.kind==='others')await api('/api/auth/sessions/revoke-others','POST',{},token);
      else await api(`/api/auth/sessions/${encodeURIComponent(confirm.id)}/revoke`,'POST',{},token);
      setConfirm(null);
      setMessage('Session access revoked. Connected workspace streams will be notified.');
      await refresh();
    }catch(e){setError(e?.message||'Could not revoke session. Try again.');}
    finally{setBusy(false);}
  }
  if(!token)return <><h2>Security & sessions</h2><p>Sign in to view and manage active sessions.</p></>;
  const others=sessions.filter(s=>!s.current);
  return <div className="pp-security-panel">
    <div className="pp-security-title"><div><h2>Security & sessions</h2><p>See where your account is signed in and revoke access you no longer recognize.</p></div>
      <button type="button" onClick={()=>refresh()} disabled={busy||loading}><RefreshCw size={15}/> Refresh</button>
    </div>
    <div className="pp-security-intro"><ShieldCheck size={18}/>
      <span>Your session stays in an HttpOnly cookie. Session IDs and CSRF proofs are never shown here.</span>
    </div>
    <div className="pp-security-section-title"><h3>Active devices <small>{sessions.length}</small></h3>
      <button type="button" disabled={loading||busy||others.length===0} onClick={()=>{setError('');setConfirm({kind:'others'});}}><LogOut size={15}/> Sign out other devices</button>
    </div>
    {loading&&sessions.length===0&&<p className="pp-settings-muted">Loading sessions…</p>}
    {!loading&&sessions.length===0&&!error&&<p className="pp-settings-muted">No active sessions found.</p>}
    <div className="pp-security-sessions">
      {sessions.map(s=>{
        const agent=describeAgent(s.userAgent), Icon=agent.mobile?Smartphone:Monitor;
        return <div key={s.id} className="pp-security-session">
          <span className="pp-security-device-icon"><Icon size={21}/></span>
          <div className="pp-security-session-meta"><div className="pp-security-session-name"><strong>{agent.name}</strong>{s.current&&<span className="pp-security-current">Current session</span>}</div>
            <small>Signed in {formatDate(s.createdAt)}</small>
            <small><Clock3 size={12}/> Expires {formatDate(s.expiresAt)}</small></div>
          {s.current?<span className="pp-security-this-device">This device</span>
            :<button type="button" disabled={busy} onClick={()=>{setError('');setConfirm({kind:'one',id:s.id,name:agent.name});}}>Revoke</button>}
        </div>;
      })}
    </div>
    {error&&<p role="alert" className="pp-security-error">{error}</p>}
    {message&&<p role="status" className="pp-security-success">{message}</p>}
    <p className="pp-security-note">Device labels come from the browser's user-agent and may be approximate. Signing out other devices keeps the current session active. To sign out here, use the account menu at the top right.</p>
    {confirm&&<div className="pp-security-confirm" role="alertdialog" aria-modal="true" aria-labelledby="security-revoke-heading">
      <div className="pp-security-confirm-inner"><AlertTriangle size={22}/><h3 id="security-revoke-heading">{confirm.kind==='others'?'Sign out other devices?':'Revoke this session?'}</h3>
        <p>{confirm.kind==='others'?`This will revoke ${others.length} other active session(s). Your current browser stays signed in.`:`${confirm.name} will need to sign in again to access PakPost.`}</p>
        <div><button disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button>
          <button className="pp-security-revoke-confirm" disabled={busy} onClick={revoke}>{busy?'Revoking…':'Revoke access'}</button></div>
      </div>
    </div>}
  </div>;
}
