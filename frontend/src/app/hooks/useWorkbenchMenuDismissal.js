import { useEffect } from 'react';

/** Preserve outside-click, Escape and resize behavior for both context menus. */
export function useWorkbenchMenuDismissal({ tabMenu, setTabMenu, workspaceMenu, setWorkspaceMenu }) {
  useEffect(()=>{
    if(!tabMenu)return;
    const dismiss=e=>{if(!e.target.closest?.('.pp-tab-context'))setTabMenu(null)};
    const escape=e=>{if(e.key==='Escape')setTabMenu(null)};
    const resized=()=>setTabMenu(null);
    window.addEventListener('pointerdown',dismiss);window.addEventListener('keydown',escape);window.addEventListener('resize',resized);
    return ()=>{window.removeEventListener('pointerdown',dismiss);window.removeEventListener('keydown',escape);window.removeEventListener('resize',resized)};
  },[tabMenu]);
  useEffect(()=>{if(!workspaceMenu)return;
    const click=e=>{if(!e.target.closest?.('.pp-collection-popup'))setWorkspaceMenu(null)};
    const key=e=>{if(e.key==='Escape')setWorkspaceMenu(null)};
    window.addEventListener('pointerdown',click);window.addEventListener('keydown',key);
    return ()=>{window.removeEventListener('pointerdown',click);window.removeEventListener('keydown',key)};
  },[workspaceMenu]);
}
