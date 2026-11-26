import React,{useEffect,useRef,useState} from 'react';
import {Monitor,Cloud,Server,Check,LogIn,Trash2,Plus,Link2,ShieldCheck,KeyRound,LoaderCircle,AlertCircle,Info,X} from 'lucide-react';
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
  return <section className="pp-desktop-connections" aria-label="Desktop connections">
    <header className="pp-desktop-settings-heading">
      <h2>Desktop connections</h2>
      <p>Choose where your workspace lives. Local data stays on this device when you switch servers.</p>
    </header>
    <div className="pp-desktop-section-label">CONNECTION PROFILES</div>
    {!ready&&<div className="pp-desktop-feedback" role="status"><LoaderCircle className="pp-desktop-spinner" size={16}/> Loading profiles…</div>}
    <div className="pp-desktop-profile-list">
      {ready&&store.profiles.map(p=>{
        const selected=p.id===store.activeId;
        const Icon=p.kind==='local'?Monitor:p.kind==='public'?Cloud:Server;
        return <div className={`pp-desktop-profile${selected?' is-selected':''}`} key={p.id}>
          <span className="pp-desktop-profile-icon"><Icon size={20} aria-hidden="true"/></span>
          <div className="pp-desktop-profile-copy">
            <div className="pp-desktop-profile-title"><strong>{p.name}</strong>{selected&&<span className="pp-desktop-selected"><Check size={12} aria-hidden="true"/> Selected</span>}</div>
            <small>{p.kind==='local'?'Offline · SQLite':p.url}</small>
            {selected&&p.kind!=='local'&&connected&&<span className="pp-desktop-connected"><span/> Connected</span>}
          </div>
          <div className="pp-desktop-profile-actions">
            {p.kind==='local'?<button className="pp-desktop-control" type="button" disabled={pairing||selected} onClick={selectLocal}>{selected?<Check size={14}/>:<Monitor size={14}/>} {selected?'In use':'Use Local'}</button>
            :<button className="pp-desktop-control is-primary" type="button" disabled={pairing} onClick={()=>signIn(p)}><LogIn size={14}/> {connected?(selected?'Reconnect':'Switch server'):'Sign in with Google'}</button>}
            {p.kind==='selfhosted'&&<button className="pp-desktop-control is-danger" type="button" disabled={pairing||selected} aria-label={`Remove ${p.name}`} title="Remove profile" onClick={()=>persist({...store,profiles:store.profiles.filter(q=>q.id!==p.id)})}><Trash2 size={14}/><span>Remove</span></button>}
          </div>
        </div>;
      })}
    </div>
    {ready&&store.activeId!=='local'&&(connected||remembered)&&<div className="pp-desktop-profile pp-desktop-vault">
      <span className="pp-desktop-profile-icon"><KeyRound size={19}/></span>
      <div className="pp-desktop-profile-copy"><strong>Keep me signed in</strong><small>{remembered?'Enabled · system credential vault':'Disabled · session stays in memory'}</small></div>
      <div className="pp-desktop-profile-actions"><button className="pp-desktop-control" type="button" disabled={vaultBusy||pairing} onClick={toggleRemembered}>{vaultBusy&&<LoaderCircle size={14} className="pp-desktop-spinner"/>}{vaultBusy?'Working…':remembered?'Forget saved login':'Enable'}</button></div>
    </div>}
    {pairing&&<div className="pp-desktop-feedback is-pairing" role="status"><LoaderCircle size={16} className="pp-desktop-spinner"/><span>Waiting for browser approval…</span><button className="pp-desktop-control" type="button" disabled={!approvalUrl} onClick={stopPairing}><X size={14}/> Stop waiting</button></div>}
    {approvalUrl&&<div className="pp-desktop-approval-link"><small>If the browser did not open, copy and open this URL:</small><code>{approvalUrl}</code></div>}
    <div className="pp-desktop-settings-divider"/>
    <div className="pp-desktop-settings-subheading"><h3>Add Self-Hosted server</h3><p>Connect to your own PakPost instance using its HTTPS address.</p></div>
    <form className="pp-desktop-profile-form" onSubmit={add}>
      <label>Profile name <span className="pp-desktop-field"><Server size={16} aria-hidden="true"/><input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Office PakPost"/></span></label>
      <label>Server URL <span className="pp-desktop-field"><Link2 size={16} aria-hidden="true"/><input required type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://pakpost.example.com" spellCheck={false} autoCapitalize="none"/></span></label>
      <div className="pp-desktop-form-footer"><span>Profiles are stored on this device.</span><button className="pp-desktop-control is-primary" type="submit" disabled={pairing||!ready}><Plus size={15}/> Save profile</button></div>
    </form>
    {error&&<div role="alert" className="pp-desktop-feedback is-error"><AlertCircle size={16}/><span>{error}</span></div>}
    {notice&&<div role="status" className="pp-desktop-feedback"><Info size={16}/><span>{notice}</span></div>}
    <div className="pp-desktop-settings-note"><ShieldCheck size={17}/><div><strong>Connection security</strong><p>Remote connections use browser-based Google sign-in and explicit device approval. Self-hosted servers must support desktop authentication and Google sign-in.</p><details><summary>Session and realtime details</summary><p>Persistent login is optional and requires an available system credential vault. Restored sessions are verified by the selected server before use. Realtime collaboration uses authenticated SignalR through the native bridge when available, with automatic REST fallback.</p></details></div></div>
  </section>;
}
