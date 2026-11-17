import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Dialog } from '../../../components/ui/WorkbenchPrimitives.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';

// Authentication modals are presentation-only; the existing auth and invitation
// handlers remain in App so this refactor cannot change token/permission flow.
export function AuthOverlays({ data, actions }) {
  const { inviteToken, inviteAcceptError, me, token, acceptingInvite, googleLinked } = data;
  const { authOpen, authMode, authForm, authError, authBusy, googleLinkOpen } = data;
  const { googleLinkPassword, googleLinkError } = data;
  const { setInviteToken, setInviteAcceptError, acceptInvitation, setAuthMode, setAuthOpen, setAuthForm } = actions;
  const { submitAuth, submitGoogleAuth, setAuthError, setGoogleLinkOpen, setGoogleLinkPassword, submitGoogleLink } = actions;
  const { setGoogleLinkError } = actions;

  return (<>
    {inviteToken&&<Dialog title="Workspace invitation" subtitle="Accept an invitation to collaborate in a PakPost workspace." onClose={()=>{setInviteToken('');setInviteAcceptError('')}}>
      <div className="modal-form">
        <p className="pp-muted-small">To accept, sign in with the Google-verified account matching the invitation email. The invitation link is one-time and expires after 7 days.</p>
        {me&&<p>Signed in as <strong>{me.email}</strong></p>}
        {inviteAcceptError&&<div className="form-error" role="alert">{inviteAcceptError}</div>}
        {token?<button type="button" className="pp-modal-submit" disabled={acceptingInvite} onClick={acceptInvitation}>{acceptingInvite?'Accepting…':'Accept invitation'}</button>:
          <button type="button" className="pp-modal-submit" onClick={()=>{setAuthMode('login');setAuthOpen(true)}}>Sign in to accept</button>}
        {token&&!googleLinked&&<p className="pp-muted-small">Your current account has no linked Google identity. Connect Google from the top bar first if the invitation email matches.</p>}
        <button type="button" className="pp-roles-button" onClick={()=>{setInviteToken('');setInviteAcceptError('')}}>Not now</button>
      </div>
    </Dialog>}
    {authOpen && <Dialog title={authMode === 'login' ? 'Welcome back' : 'Create account'} subtitle="Sign in to manage your collections, teams and workspaces. API testing stays open to everyone." onClose={()=>setAuthOpen(false)}>
      <form className="modal-form" onSubmit={submitAuth}>
        {authMode==='register' && <label>Display name<input required maxLength={120} placeholder="Your name" value={authForm.displayName} onChange={e=>setAuthForm(v=>({...v,displayName:e.target.value}))}/></label>}
        <label>Email address<input type="email" required autoComplete="email" value={authForm.email} placeholder="you@example.com" onChange={e=>setAuthForm(v=>({...v,email:e.target.value}))}/></label>
        <label>Password<input type="password" required minLength={authMode === 'register' ? 12 : 1} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder={authMode === 'register' ? 'At least 12 characters' : 'Your password'} value={authForm.password} onChange={e=>setAuthForm(v=>({...v,password:e.target.value}))}/></label>
        {authError && <div className="form-error" role="alert">{authError}</div>}
        <button className="pp-modal-submit" disabled={authBusy} type="submit">{authBusy ? 'Working...' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17}/></button>
        <p className="form-toggle">{authMode === 'login' ? 'New to Pakpost?' : 'Already have an account?'} <button type="button" onClick={()=>{setAuthMode(v=>v==='login'?'register':'login');setAuthError('');}}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p>
      </form>
      {GOOGLE_CLIENT_ID && <div className="pp-google-auth-section">
        <div className="pp-google-divider">or continue with</div>
        <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} disabled={authBusy} onCredential={submitGoogleAuth} onError={setAuthError}/>
        <p className="pp-muted-small pp-center">Already have an email/password account? Sign in and choose Connect Google first.</p>
      </div>}
    </Dialog>}
    {googleLinkOpen && me && <Dialog title="Connect Google" subtitle={`Link Google to ${me.email}. This keeps your existing workspaces and collections.`} onClose={()=>setGoogleLinkOpen(false)}>
      <div className="modal-form">
        <label>Confirm your PakPost password<input type="password" autoComplete="current-password" value={googleLinkPassword} onChange={e=>setGoogleLinkPassword(e.target.value)} placeholder="Existing account password"/></label>
        {googleLinkError && <div className="form-error" role="alert">{googleLinkError}</div>}
        {googleLinkPassword && <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} disabled={authBusy} onCredential={submitGoogleLink} onError={setGoogleLinkError}/>}
        {!googleLinkPassword && <p className="pp-muted-small">Enter your PakPost password to enable Google linking.</p>}
      </div>
    </Dialog>}
  </>);
}
