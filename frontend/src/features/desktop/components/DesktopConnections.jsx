import React,{useEffect,useRef,useState} from 'react';
import {DEFAULT_PROFILES,getDesktopProfiles,putDesktopProfiles,validateCustomServer} from '../services/connectionProfiles.js';
import {setDesktopContext} from '../../../services/httpClient.js';
import {isTauriDesktop} from '../../collections/services/desktopLocalRepository.js';
const invoke = async (name,args) => (await import('@tauri-apps/api/core')).invoke(name,args);

/** Only the *selected* remote server receives native API requests. All auth secrets
 * stay in Rust memory or the OS credential vault. Switching mode reloads the app to clear cached workspaces. */
export function DesktopConnections(){
  const [store,setStore]=useState(DEFAULT_PROFILES),[ready,setReady]=useState(false);
  const [name,setName]=useState(''),[url,setUrl]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [pairing,setPairing]=useState(false),[approvalUrl,setApprovalUrl]=useState(''),[connected,setConnected]=useState(false);
  const [remembered,setRemembered]=useState(false),[vaultBusy,setVaultBusy]=useState(false);
  const generation=useRef(0), approvalGeneration=useRef(null);
  useEffect(()=>{let live=true;Promise.all([getDesktopProfiles(),invoke('desktop_remote_status'),invoke('desktop_remembered_status')])
    .then(([profiles,online,saved])=>{if(live){setStore(profiles);setConnected(online);setRemembered(saved);setReady(true)}})
    .catch(e=>{if(live){setError(String(e));setReady(true)}});return()=>{live=false;generation.current++}},[]);
  async function toggleRemembered(){
    setVaultBusy(true);setError('');setNotice('');
    try{
      await invoke(remembered?'forget_remote_session':'remember_remote_session');
      setNotice(remembered?'Persistent login disabled.':'Session saved in your system credential vault.');
    }catch(e){setError(String(e));}
    finally{
      try{setRemembered(await invoke('desktop_remembered_status'));}catch{}
      setVaultBusy(false);
    }
  }
  async function persist(next){
    setError('');setNotice('');
    try{
      await putDesktopProfiles(next);
      if(next.activeId!==store.activeId){
        // Cloud-only session sidecars must not follow a different server.
        try{sessionStorage.removeItem('pakpost_workspace_collection_docs_v21')}catch{}
      }
      setStore(next);setNotice('Connection profile saved in local SQLite.');return true;
    }
    catch(e){setError(String(e));return false;}
  }
  async function selectLocal(){
    generation.current++;
    // Revoke the selected remote session before returning to Local.
    try{if(store.activeId!=='local')await invoke('disconnect_remote');
      if(await persist({...store,activeId:'local'})){window.__PAKPOST_DESKTOP_REMOTE__=false;window.location.reload();}
    }catch(e){setError(String(e))}
  }
  async function signIn(profile){
    setError('');setNotice('');setApprovalUrl('');approvalGeneration.current=null;setPairing(true);
    const current=++generation.current;
    try{
      // Clear the previous account before selecting a different remote server.
      if(connected && store.activeId!==profile.id){
        await invoke('disconnect_remote');setDesktopContext(null);window.__PAKPOST_DESKTOP_REMOTE__=false;
        if(await persist({...store,activeId:profile.id}))window.location.reload();
        return;
      }
      if(!await persist({...store,activeId:profile.id}))throw Error('Unable to save selected profile');
      if(generation.current!==current)return;
      // Consent URL is opened in the system browser by Rust; never inside Tauri.
      const info=await invoke('begin_remote_sign_in',{profileId:profile.id});
      if(generation.current!==current)return;
      approvalGeneration.current=info.generation;setApprovalUrl(info.approvalUrl);
      setNotice('Sign in with Google in the browser, return to the approval page and approve this desktop.');
      for(let n=0;n<145;n++){
        if(generation.current!==current)return;
        await new Promise(r=>setTimeout(r,2000));
        if(generation.current!==current)return;
        const result=await invoke('poll_remote_sign_in',{generation:info.generation});
        if(generation.current!==current)return;
        if(result==='approved'){
          setConnected(true);window.__PAKPOST_DESKTOP_REMOTE__=true;
          window.location.reload();return;
        }
      }
      throw Error('Login request expired. Try signing in again.');
    }catch(e){if(generation.current===current)setError(String(e))}
    finally{if(generation.current===current)setPairing(false)}
  }
  async function stopPairing(){
    generation.current++;
    try{if(approvalGeneration.current!==null)await invoke('cancel_remote_sign_in',{generation:approvalGeneration.current});setApprovalUrl('');setNotice('Desktop approval cancelled.');}
    catch(e){setError(String(e));}
    finally{setPairing(false);}
  }
  async function add(e){
    e.preventDefault();
    try{const server=validateCustomServer(url);
      if(store.profiles.some(p=>p.url===server))throw Error('Server already exists');
      const profile={id:`custom-${crypto.randomUUID()}`,name:name.trim(),kind:'selfhosted',url:server};
      if(!profile.name||profile.name.length>80)throw Error('Enter a server name (max 80 characters)');
      if(await persist({...store,profiles:[...store.profiles,profile]})){setName('');setUrl('');}
    }catch(e){setError(String(e.message||e))}
  }
  if(!isTauriDesktop())return null;
  return <section className="pp-desktop-connections">
    <h2>Desktop connections</h2>
    <p>Local mode is offline. Remote modes use the selected PakPost server with browser-based Google sign-in and explicit device approval. No Local data is uploaded when switching.</p>
    {!ready&&<p>Loading profiles…</p>}
    {ready&&store.profiles.map(p=><div className="pp-desktop-profile" key={p.id}>
      <div><strong>{p.name}{p.id===store.activeId?' · Selected':''}</strong><small>{p.kind==='local'?'Offline · SQLite':p.url}</small></div>
      <div className="pp-desktop-profile-actions">
        {p.kind==='local'?<button type="button" disabled={pairing||store.activeId==='local'} onClick={selectLocal}>Use Local</button>
        :<button type="button" disabled={pairing} onClick={()=>signIn(p)}>{connected?(p.id===store.activeId?'Reconnect':'Switch server'):'Sign in with Google'}</button>}
        {p.kind==='selfhosted'&&<button type="button" disabled={pairing||store.activeId===p.id} onClick={()=>persist({...store,profiles:store.profiles.filter(q=>q.id!==p.id)})}>Remove</button>}
      </div>
    </div>)}
    {ready&&store.activeId!=='local'&&(connected||remembered)&&<div className="pp-desktop-profile">
      <div><strong>Keep me signed in</strong><small>{remembered?'Enabled · system credential vault':'Disabled · session stays in memory'}</small></div>
      <div className="pp-desktop-profile-actions"><button type="button" disabled={vaultBusy||pairing} onClick={toggleRemembered}>{vaultBusy?'Working…':remembered?'Forget saved login':'Enable'}</button></div>
    </div>}
    {pairing&&<p role="status">Waiting for browser approval… <button type="button" disabled={!approvalUrl} onClick={stopPairing}>Stop waiting</button></p>}
    {approvalUrl&&<p><small>If the browser did not open, copy and open this URL: <code>{approvalUrl}</code></small></p>}
    <h3>Add Self-Hosted server</h3>
    <form className="pp-desktop-profile-form" onSubmit={add}>
      <label>Profile name <input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Office PakPost"/></label>
      <label>Server URL <input required type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://pakpost.example.com"/></label>
      <button type="submit" disabled={pairing}>Save profile</button>
    </form>
    {error&&<p role="alert" className="form-error">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    <p><small>Each Self-Hosted instance must run the PakPost desktop-auth backend endpoints and have Google sign-in configured. Persistent login is optional and requires an available system credential vault. A restored session is verified by the selected server before use. Realtime collaboration uses authenticated SignalR through the native bridge when available, with automatic REST fallback.</small></p>
  </section>;
}
