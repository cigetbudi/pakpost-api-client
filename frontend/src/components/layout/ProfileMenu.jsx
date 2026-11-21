import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown, LogOut, ShieldCheck, Link2, X} from 'lucide-react';
import {safeGoogleAvatar} from '../../features/auth/services/googleAvatar.js';

// Display-only URL from the already-verified Google identity. Reject other image
// hosts so a compromised API response cannot make the UI load arbitrary URLs.

export function ProfileAvatar({user, size='small'}) {
  const url = safeGoogleAvatar(user?.avatarUrl);
  const [failed,setFailed] = useState(false);
  useEffect(()=>setFailed(false),[url]);
  const initial = (user?.displayName || user?.email || '?').trim().charAt(0).toUpperCase();
  return <span className={`pp-user-avatar pp-user-avatar-${size}`} aria-hidden="true">
    {url && !failed ? <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy"
      onError={()=>setFailed(true)}/> : initial}
  </span>;
}

export function ProfileMenu({me,logout,onOpenSecurity,onConnectGoogle,canLinkGoogle}) {
  const [open,setOpen] = useState(false);
  const [confirm,setConfirm] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!rootRef.current?.contains(e.target))setOpen(false);};
    const escape=e=>{if(e.key==='Escape'){setOpen(false);triggerRef.current?.focus();}};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  useEffect(()=>{if(confirm)cancelRef.current?.focus();},[confirm]);
  useEffect(()=>{
    if(!confirm)return;
    const escape=e=>{if(e.key==='Escape'&&!busy){setConfirm(false);triggerRef.current?.focus();}};
    document.addEventListener('keydown',escape);
    return()=>document.removeEventListener('keydown',escape);
  },[confirm,busy]);

  async function signOut(){
    if(busy)return;
    setBusy(true);setError('');
    try {
      const succeeded=await logout();
      if(succeeded===false){setError('Unable to revoke the session. Please try again.');return;}
      setConfirm(false);setOpen(false);
    } catch(e){setError(e?.message || 'Sign out failed. Please try again.');}
    finally{setBusy(false);}
  }

  return <>
    <div className="pp-profile-anchor" ref={rootRef}>
      <button type="button" ref={triggerRef} className="pp-profile" aria-label="Account menu"
        aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
        <ProfileAvatar user={me}/><span className="pp-profile-name">{me.displayName}</span>
        <ChevronDown size={15} className={open?'pp-profile-chevron-open':''}/>
      </button>
      {open && <div className="pp-account-menu" role="menu" aria-label="Account">
        <div className="pp-account-identity"><ProfileAvatar user={me} size="large"/>
          <div><strong title={me.displayName}>{me.displayName}</strong><small title={me.email}>{me.email}</small></div>
        </div>
        <div className="pp-account-menu-divider"/>
        <button role="menuitem" onClick={()=>{setOpen(false);onOpenSecurity?.();}}><ShieldCheck size={16}/> Security & sessions</button>
        {canLinkGoogle&&<button role="menuitem" onClick={()=>{setOpen(false);onConnectGoogle?.();}}><Link2 size={16}/> Connect Google</button>}
        <div className="pp-account-menu-divider"/>
        <button role="menuitem" className="pp-account-signout" onClick={()=>{setOpen(false);setConfirm(true);setError('');}}><LogOut size={16}/> Sign out</button>
      </div>}
    </div>
    {confirm&&createPortal(<div className="pp-signout-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setConfirm(false);}}>
      <div className="pp-signout-modal" role="alertdialog" aria-modal="true" aria-labelledby="pp-signout-title" aria-describedby="pp-signout-desc">
        <div className="pp-signout-modal-heading"><span className="pp-signout-modal-icon"><LogOut size={20}/></span>
          <button type="button" aria-label="Close" disabled={busy} onClick={()=>setConfirm(false)}><X size={18}/></button></div>
        <h2 id="pp-signout-title">Sign out of PakPost?</h2>
        <p id="pp-signout-desc">Your server session on this browser will be revoked. Local collections and unsaved local drafts stay on this device.</p>
        {error&&<p role="alert" className="pp-signout-error">{error}</p>}
        <div className="pp-signout-actions"><button type="button" ref={cancelRef} disabled={busy} onClick={()=>{setConfirm(false);triggerRef.current?.focus();}}>Stay signed in</button>
          <button type="button" disabled={busy} className="pp-signout-confirm" onClick={signOut}>{busy?'Signing out…':'Yes, sign out'}</button>
        </div>
      </div>
    </div>,document.body)}
  </>;
}
