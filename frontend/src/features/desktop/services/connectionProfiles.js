import {isTauriDesktop} from '../../collections/services/desktopLocalRepository.js';
const invoke = async (name, args) => (await import('@tauri-apps/api/core')).invoke(name,args);
export const DEFAULT_PROFILES = Object.freeze({activeId:'local',profiles:[
  {id:'local',name:'Local Workspace',kind:'local',url:null},
  {id:'public',name:'PakPost Cloud',kind:'public',url:'https://pakpost.duckdns.org'},
]});
export async function getDesktopProfiles(){
  if(!isTauriDesktop())return DEFAULT_PROFILES;
  return invoke('load_connection_profiles');
}
export async function putDesktopProfiles(data){
  if(!isTauriDesktop())throw Error('Desktop only');
  await invoke('save_connection_profiles',{store:data});
}
export function validateCustomServer(url){
  const value=url.trim();
  const parsed=new URL(value);
  if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'||value.length>512|| /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname))
    throw Error('Use an HTTPS hostname without path, credentials, query, or fragment');
  return parsed.origin;
}
