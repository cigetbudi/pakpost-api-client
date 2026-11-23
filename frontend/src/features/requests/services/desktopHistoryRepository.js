import { isTauriDesktop } from '../../collections/services/desktopLocalRepository.js';
const invoke = async (command, args) => (await import('@tauri-apps/api/core')).invoke(command, args);

// History intentionally excludes body, headers and credentials. Redact sensitive
// query-string parameters before writing URLs to disk.
const sensitive = /token|secret|password|key|signature|authorization|session|code|credential|jwt|auth/i;
export function sanitizeLocalHistory(items) {
  return (Array.isArray(items) ? items : []).slice(0,100).map(entry => {
    let url = String(entry.url || '').slice(0,2048);
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) {parsed.username='';parsed.password='';}
      for (const key of [...parsed.searchParams.keys()]) if (sensitive.test(key)) parsed.searchParams.set(key,'[REDACTED]');
      parsed.hash='';
      url=parsed.toString();
    } catch {url='[template URL omitted]';}
    return {method:String(entry.method||'GET').slice(0,16),url,status:Number(entry.status)||0,elapsed:Number(entry.elapsed)||0};
  });
}
export async function loadDesktopHistory() {
  if (!isTauriDesktop()) return [];
  const result=await invoke('load_local_history');
  if (result == null) return [];
  if(result.version!==1 || !Array.isArray(result.entries)) throw Error('Invalid desktop history');
  return sanitizeLocalHistory(result.entries);
}
export async function saveDesktopHistory(items) {
  if(!isTauriDesktop())return;
  await invoke('save_local_history',{snapshot:{version:1,entries:sanitizeLocalHistory(items)}});
}
