// Environment variable access, session-only QA edits and active environment labels.
// Keeping this pure preserves Cloud role checks and avoids a new React subscription.
export function createActiveEnvironmentBridge({
  STORAGE_WORKSPACE, activeEnvironment, activeSessionEnvironmentKey,
  activeSessionOverrides, applySessionOverrides, canWriteEnvironment,
  envScope, isSensitiveVariable, persistEnvironment, putEnvironmentVariable,
  readableEnvironmentValues, refreshSessionEnvironment, selectedWs,
  sessionEnvironmentOverlays, sessionOverridesFromValues, setExplorerTab,
  setNotice, storeSessionOverrides, workspaces,
}) {
  const varsFromEnv=(allowSecrets=true)=>{
    const base=readableEnvironmentValues(activeEnvironment);
    const variables=envScope===STORAGE_WORKSPACE?applySessionOverrides(base,activeSessionOverrides):base;
    if(!allowSecrets){
      for(const key of Object.keys(variables)){
        const definition=activeEnvironment?.variables?.find(v=>v.key===key);
        if(isSensitiveVariable(key,definition))variables[key]='[REDACTED]';
      }
    }
    return variables;
  };
  function rememberSessionValues(key,environment,values){
    if(!key||!environment)return;
    const next=sessionOverridesFromValues(readableEnvironmentValues(environment),values);
    if(storeSessionOverrides(sessionEnvironmentOverlays.current,key,next))refreshSessionEnvironment(v=>v+1);
  }
  async function quickEditVariable(key,value){
    if(!activeEnvironment)throw Error('Select an environment in the top toolbar first.');
    if(envScope===STORAGE_WORKSPACE&&!canWriteEnvironment){
      // Validate the key and reject edits to restricted server-side secrets.
      putEnvironmentVariable(activeEnvironment.variables,key,value);
      rememberSessionValues(activeSessionEnvironmentKey,activeEnvironment,{...varsFromEnv(),[key]:String(value)});
      setNotice('Variable changed for this session only. Cloud environment is unchanged.');
      return;
    }
    if(envScope===STORAGE_WORKSPACE&&(activeEnvironment.variables||[]).some(v=>v.isRedacted))
      throw Error('This environment contains restricted variables. Open Environments to edit with appropriate permissions.');
    const variables=putEnvironmentVariable(activeEnvironment.variables,key,value);
    await persistEnvironment({...activeEnvironment,variables});
  }
  const variableUi={variables:varsFromEnv(),definitions:activeEnvironment?.variables||[],
    source:activeEnvironment?`${envScope===STORAGE_WORKSPACE?`Cloud · ${workspaces.find(w=>w.id===selectedWs)?.name||'Workspace'}`:'Local · Browser'} / ${activeEnvironment.name}${envScope===STORAGE_WORKSPACE&&!canWriteEnvironment?' · Session-only edits':''}`:'No active environment',
    onEditVariable:activeEnvironment?quickEditVariable:null,
    onOpenEnvironments:()=>setExplorerTab('environments')};
  return { varsFromEnv, rememberSessionValues, variableUi };
}
