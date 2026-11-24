import {useSyncExternalStore} from 'react';
import {normalizeWorkbenchPreferences,readWorkbenchPreferences,WORKBENCH_PREFERENCES_KEY} from './workbenchPreferences.js';
let current;
try{current=readWorkbenchPreferences(globalThis.localStorage);}catch{current=readWorkbenchPreferences();}
const listeners=new Set();
function notify(value){current=normalizeWorkbenchPreferences(value);listeners.forEach(fn=>fn());}
function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
  if(event.key===WORKBENCH_PREFERENCES_KEY||event.key===null){try{notify(readWorkbenchPreferences(window.localStorage));}catch{}}
});
export function updateWorkbenchPreferences(patch){
  const next=normalizeWorkbenchPreferences({...current,...patch});
  try{globalThis.localStorage?.setItem(WORKBENCH_PREFERENCES_KEY,JSON.stringify(next));}catch{}
  notify(next);
}
export function useWorkbenchPreferences(){return useSyncExternalStore(subscribe,()=>current,()=>current);}
