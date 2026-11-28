import React, {useState, useRef} from 'react';
import {Channel, invoke} from '@tauri-apps/api/core';
import {RefreshCw} from 'lucide-react';

// Deliberately no useEffect, polling, remote credentials or startup request.
export function DesktopUpdates(){
  const [phase,setPhase]=useState('idle');
  const [version,setVersion]=useState('');
  const [message,setMessage]=useState('');
  const [progress,setProgress]=useState(null);
  const running=useRef(false);
  async function check(){
    if(running.current)return;
    running.current=true;setPhase('checking');setVersion('');setMessage('');setProgress(null);
    try{
      const update=await invoke('check_pakpost_update');
      if(update){setVersion(update.version);setPhase('available');}
      else{setPhase('idle');setMessage('You are up to date.');}
    }catch(error){setPhase('idle');setMessage(String(error));}
    finally{running.current=false;}
  }
  async function install(){
    if(running.current||!version)return;
    running.current=true;setPhase('installing');setMessage('');
    const channel=new Channel();channel.onmessage=setProgress;
    try{
      await invoke('install_pakpost_update',{version,progress:channel});
      setPhase('installed');setMessage('Update installed. Close and reopen PakPost.');
    }catch(error){setPhase('idle');setVersion('');setMessage(String(error));}
    finally{running.current=false;}
  }
  const busy=phase==='checking'||phase==='installing';
  return <div className="pp-settings-privacy"><RefreshCw size={20}/><div style={{minWidth:0,width:'100%'}}>
    <strong>Software updates</strong><p>Only checks GitHub when requested. No background update checks or account data sent by PakPost.</p>
    <button type="button" className="pp-extension-check" disabled={busy||phase==='installed'} onClick={check}>{phase==='checking'?'Checking…':'Check for updates'}</button>
    {phase==='available'&&<><p>PakPost {version} is available. Save your work and export important local data before installing.</p><button type="button" className="pp-extension-check" onClick={install}>Download and install {version}</button></>}
    {phase==='installing'&&<><p>Downloading and verifying update…</p>{progress?.total>0?<progress aria-label="Update download progress" value={Math.min(progress.downloaded,progress.total)} max={progress.total}/>:<progress aria-label="Update download progress"/>}</>}
    {message&&<p role="status">{message}</p>}
  </div></div>;
}
