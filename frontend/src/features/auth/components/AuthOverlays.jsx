import React from 'react';
import { Dialog } from '../../../components/ui/WorkbenchPrimitives.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';

// Authentication modals are presentation-only; the existing auth and invitation
// handlers remain in App so this refactor cannot change token/permission flow.
export function AuthOverlays({ data, actions }) {
  const { inviteToken, inviteAcceptError, me, token, acceptingInvite, googleLinked } = data;
  const { authOpen, authError, authBusy, googleLinkOpen } = data;
  const { googleLinkPassword, googleLinkError } = data;
  const { setInviteToken, setInviteAcceptError, acceptInvitation, setAuthOpen } = actions;
  const { submitGoogleAuth, setAuthError, setGoogleLinkPassword, submitGoogleLink } = actions;
  const { setGoogleLinkError } = actions;

  return (<>
    {inviteToken&&<Dialog title="Workspace invitation" subtitle="Accept an invitation to collaborate in a PakPost workspace." onClose={()=>{setInviteToken('');setInviteAcceptError('')}}>
      <div className="modal-form">
        <p className="pp-muted-small">To accept, sign in with the Google-verified account matching the invitation email. The invitation link is one-time and expires after 7 days.</p>
        {me&&<p>Signed in as <strong>{me.email}</strong></p>}
        {inviteAcceptError&&<div className="form-error" role="alert">{inviteAcceptError}</div>}
        {token?<button type="button" className="pp-modal-submit" disabled={acceptingInvite} onClick={acceptInvitation}>{acceptingInvite?'Accepting…':'Accept invitation'}</button>:
          <button type="button" className="pp-modal-submit" onClick={()=>setAuthOpen(true)}>Sign in to accept</button>}
        {token&&!googleLinked&&<p className="pp-muted-small">Your current account has no linked Google identity. Connect Google from the top bar first if the invitation email matches.</p>}
        <button type="button" className="pp-roles-button" onClick={()=>{setInviteToken('');setInviteAcceptError('')}}>Not now</button>
      </div>
    </Dialog>}
    {authOpen && <Dialog title="Sign in to PakPost" subtitle="Use Google to sign in or create your account. The REST API tester stays available without signing in." onClose={()=>setAuthOpen(false)}>
      <div className="modal-form">
        {authError && <div className="form-error" role="alert">{authError}</div>}
        {GOOGLE_CLIENT_ID ? <div className="pp-google-auth-section">
          <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} disabled={authBusy} onCredential={submitGoogleAuth} onError={setAuthError}/>
          {authBusy && <p className="pp-muted-small pp-center" role="status">Signing in…</p>}
        </div> : <p className="form-error" role="alert">Google sign-in is not configured on this PakPost instance. Contact the administrator.</p>}
        <p className="pp-muted-small pp-center">New accounts are created automatically after Google verification. PakPost never receives your Google password.</p>
      </div>
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
