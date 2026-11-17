// Presentation-only composition: state, API calls and mutation stay in App until their controllers are extracted.
// Each dependency is explicit so this component can be tested independently.
export function AppHeader(props) {
  const {
    GOOGLE_CLIENT_ID, Link2, LogIn, LogOut, RetroSelect, STORAGE_LOCAL, STORAGE_WORKSPACE,
    Search, Settings2, activeEnvId, activeWorkspace, currentEnvironments, envScope, googleLinked,
    isDarkAppearance, logout, me, openContext, selectedWs, setActiveEnvId, setAuthOpen,
    setCommandIndex, setCommandOpen, setCommandQuery, setGoogleLinkError, setGoogleLinkOpen, setGoogleLinkPassword, storageScope,
    theme, token, updateStorageScope, workspaces,
  } = props;
  return <>
    <header className="pp-top">
      <div className="pp-logo pp-branding" aria-label="Pakpost"><img src={isDarkAppearance(theme)?"/branding/pakpost-logo-dark.svg":"/branding/pakpost-logo-light.svg"} alt="Pakpost" width="155" height="48" decoding="async"/></div>
      <button className="pp-top-search" type="button" aria-label="Search requests and commands" onClick={()=>{setCommandQuery('');setCommandIndex(0);setCommandOpen(true);}}><Search size={15}/><span>Search requests and commands</span><kbd>Ctrl K</kbd></button>
      <div className="pp-top-right">
        <div className="pp-env-top pp-unified-storage-top">
          <span>STORAGE</span>
          {token?<RetroSelect ariaLabel="Storage location for collections and environments" title="Controls storage for both Collections and Environments" className="pp-top-scope" value={storageScope} onChange={updateStorageScope} options={[{value:STORAGE_LOCAL,label:'Local · Browser'},{value:STORAGE_WORKSPACE,label:'Cloud · Neon',disabled:!selectedWs}]}/>:<span className="pp-top-env-local" title="Sign in to use Cloud · Neon">Local · Browser</span>}
          {token&&envScope===STORAGE_WORKSPACE&&<span className="pp-workspace-indicator" title={`Active environment workspace: ${activeWorkspace?.name||'Select workspace'}`}>{activeWorkspace?.name||'Select workspace'}</span>}
          <span className="pp-top-env-label">ENV</span>
          <RetroSelect ariaLabel="Active environment" title={envScope===STORAGE_WORKSPACE?`Environment for ${workspaces.find(w=>w.id===selectedWs)?.name||'selected workspace'}`:'Local environment'} className="pp-top-environment" value={activeEnvId} onChange={setActiveEnvId} options={[{value:'',label:'No environment'},...currentEnvironments.map(e=>({value:e.id,label:e.name}))]}/>
          <button title="Manage environments" onClick={()=>openContext('environments')}><Settings2 size={16}/></button>
        </div>
        <span className="pp-connection"><span/> Local development</span>
        {me ? <><button className="pp-profile" type="button" title={`Sign out · ${me.email}`} aria-label="Sign out" onClick={logout}><span>{me.displayName.slice(0, 1).toUpperCase()}</span><span className="pp-profile-name">{me.displayName}</span><LogOut size={14}/></button>{GOOGLE_CLIENT_ID&&!googleLinked && <button type="button" className="pp-google-link-top" title="Connect Google to your existing PakPost account" onClick={()=>{setGoogleLinkError('');setGoogleLinkPassword('');setGoogleLinkOpen(true);}}><Link2 size={14}/> Connect Google</button>}</> : <button className="pp-signin" onClick={() => setAuthOpen(true)}><LogIn size={15}/> Sign in</button>}
      </div>
    </header>
  </>;
}
