import React, {useEffect, useState} from 'react';

// Rendered in a normal SYSTEM BROWSER at /desktop-connect?request=<public-id>.
// The desktop secret is deliberately not present in the URL or this page.
export function DesktopApproval() {
  const requestId=new URLSearchParams(window.location.search).get('request')||'';
  const [session,setSession]=useState(null),[error,setError]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  async function check(){
    try{const r=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});
      if(!r.ok)throw Error(`Session check failed: ${r.status}`);
      setSession(await r.json());setError('');}catch(e){setError(String(e.message||e));}
  }
  useEffect(()=>{check()},[]);
  async function approve(){
    setBusy(true);setError('');
    try{const r=await fetch('/api/desktop-auth/approve',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-PakPost-CSRF':session.csrfToken},body:JSON.stringify({requestId})});
      if(!r.ok)throw Error((await r.json().catch(()=>null))?.message||`Approval failed: ${r.status}`);
      setDone(true);
    }catch(e){setError(String(e.message||e));}finally{setBusy(false)}
  }
  return <main style={{fontFamily:'system-ui',maxWidth:520,margin:'12vh auto',padding:24}}>
    <h1>Connect PakPost Desktop</h1>
    <p>Only approve if you started this request from your own desktop app. Approval gives that app access to your PakPost workspaces.</p>
    {!/^[a-zA-Z0-9_-]{43}$/.test(requestId)?<p>Invalid request link.</p>:done?<p>Approved. You can return to the desktop app.</p>
    :session?.authenticated?<><p>Signed in as <strong>{session.user?.email||session.user?.displayName}</strong>.</p>
      <button disabled={busy} onClick={approve}>Approve desktop access</button></>
    :<><p>Sign into this PakPost instance with Google in your browser first, then return here and check again.</p>
      <a href="/" target="_blank" rel="noopener noreferrer">Open PakPost login</a>{' · '}
      <button onClick={check}>Check sign-in</button></>}
    {error&&<p role="alert" style={{color:'crimson'}}>{error}</p>}
  </main>;
}
