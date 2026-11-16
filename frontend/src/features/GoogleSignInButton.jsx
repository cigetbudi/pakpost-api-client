import React, {useEffect, useRef, useState} from 'react';

let googleScriptPromise;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google Sign-In unavailable'));
      script.onerror = () => reject(new Error('Google Sign-In could not load'));
      document.head.appendChild(script);
    }).catch(error => { googleScriptPromise = null; throw error; });
  }
  return googleScriptPromise;
}

export function GoogleSignInButton({clientId, onCredential, onError, disabled = false}) {
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    if (!clientId || disabled) return;
    let active = true;
    loadGoogleScript().then(gsi => {
      if (!active || !containerRef.current) return;
      gsi.initialize({
        client_id: clientId,
        auto_select: false,
        callback: response => {
          if (active && response?.credential) callbackRef.current(response.credential);
        },
      });
      containerRef.current.replaceChildren();
      gsi.renderButton(containerRef.current, {type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', width: 290});
    }).catch(error => {
      if (active) { setLoadError(error.message); errorRef.current?.(error.message); }
    });
    return () => { active = false; };
  }, [clientId, disabled]);
  if (!clientId) return null;
  return <div className="pp-google-signin">
    <div ref={containerRef} aria-label="Continue with Google" />
    {loadError && <p role="alert" className="form-error">{loadError}</p>}
  </div>;
}
