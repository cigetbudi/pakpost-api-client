import { useState } from 'react';

/** Auth form/dialog state is ephemeral. The JWT/session remains outside this hook. */
export function useAuthOverlayState() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ displayName: '', email: '', password: '' });
  const [googleLinkOpen, setGoogleLinkOpen] = useState(false);
  const [googleLinkPassword, setGoogleLinkPassword] = useState('');
  const [googleLinkError, setGoogleLinkError] = useState('');
  const [googleLinked,setGoogleLinked] = useState(false);
  const [inviteToken,setInviteToken] = useState(()=>new URLSearchParams(window.location.search).get('invite')||'');
  const [acceptingInvite,setAcceptingInvite] = useState(false);
  const [inviteAcceptError,setInviteAcceptError] = useState('');

  return {
    authOpen, setAuthOpen, authMode, setAuthMode, authBusy, setAuthBusy,
    authError, setAuthError, authForm, setAuthForm, googleLinkOpen, setGoogleLinkOpen,
    googleLinkPassword, setGoogleLinkPassword, googleLinkError, setGoogleLinkError, googleLinked, setGoogleLinked,
    inviteToken, setInviteToken, acceptingInvite, setAcceptingInvite, inviteAcceptError, setInviteAcceptError,
  };
}
