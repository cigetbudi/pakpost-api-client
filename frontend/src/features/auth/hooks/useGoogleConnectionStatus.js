import {useEffect} from 'react';

/** Google account badge, never a replacement for server-side session validation. */
export function useGoogleConnectionStatus({token,setGoogleLinked,api}){
  useEffect(()=>{
    let active=true;
    if(!token){setGoogleLinked(false);return;}
    api('/api/auth/google/status','GET',undefined,token)
      .then(value=>{if(active)setGoogleLinked(!!value.connected);})
      .catch(()=>{if(active)setGoogleLinked(false);});
    return()=>{active=false;};
  },[token,setGoogleLinked,api]);
}
