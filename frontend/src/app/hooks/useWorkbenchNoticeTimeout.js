import {useEffect} from 'react';

/** Clear notices after the same lifetime as the original Workbench UI. */
export function useWorkbenchNoticeTimeout(notice,setNotice){
  useEffect(()=>{
    if(!notice)return;
    const timer=setTimeout(()=>setNotice(''),4200);
    return()=>clearTimeout(timer);
  },[notice,setNotice]);
}
