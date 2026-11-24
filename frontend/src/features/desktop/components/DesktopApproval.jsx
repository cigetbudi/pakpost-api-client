import React, { useEffect, useMemo, useState } from 'react';

// Rendered in a normal SYSTEM BROWSER at /desktop-connect?request=<public-id>.
// The desktop secret is deliberately not present in the URL or this page.
export function DesktopApproval() {
  const requestId = new URLSearchParams(window.location.search).get('request') || '';
  const isValidRequest = /^[a-zA-Z0-9_-]{43}$/.test(requestId);

  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const displayName =
    session?.user?.displayName?.trim() ||
    session?.user?.email?.trim() ||
    'PakPost user';

  const initials = useMemo(() => {
    const source =
      session?.user?.displayName?.trim() ||
      session?.user?.email?.trim() ||
      'P';
    const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map(part => part[0]?.toUpperCase() || '').join('') || 'P';
  }, [session]);

  async function check() {
    setChecking(true);
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Session check failed: ${response.status}`);
      setSession(await response.json());
      setError('');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    check();
  }, []);

  async function approve() {
    if (!session?.csrfToken) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/desktop-auth/approve', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-PakPost-CSRF': session.csrfToken,
        },
        body: JSON.stringify({ requestId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Approval failed: ${response.status}`);
      }
      setDone(true);
      setError('');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  function closePage() {
    window.close();
  }

  return (
    <main className="pp-desktop-approval-page">
      <section className="pp-desktop-approval-card">
        <div className="pp-desktop-approval-badge">PakPost Desktop approval</div>

        <header className="pp-desktop-approval-header">
          <div>
            <h1>Connect PakPost Desktop</h1>
            <p>
              Only approve this request if it was started from your own desktop app.
              Approval gives that desktop app access to your PakPost workspaces.
            </p>
          </div>
          <div className="pp-desktop-approval-status">
            <span
              className={`pp-desktop-approval-pill ${
                done
                  ? 'is-success'
                  : session?.authenticated
                    ? 'is-ready'
                    : 'is-neutral'
              }`}
            >
              {done
                ? 'Approved'
                : session?.authenticated
                  ? 'Ready to approve'
                  : 'Sign-in required'}
            </span>
          </div>
        </header>

        <div className="pp-desktop-approval-panel">
          {!isValidRequest ? (
            <div className="pp-desktop-approval-state">
              <div className="pp-desktop-approval-icon">!</div>
              <div>
                <h2>Invalid request link</h2>
                <p>
                  This approval link is missing or malformed. Start the sign-in flow again
                  from PakPost Desktop, then reopen the new browser page.
                </p>
              </div>
              <div className="pp-desktop-approval-actions">
                <a className="pp-desktop-button is-primary" href="/" target="_blank" rel="noopener noreferrer">
                  Open PakPost
                </a>
              </div>
            </div>
          ) : done ? (
            <div className="pp-desktop-approval-state is-success">
              <div className="pp-desktop-approval-icon">✓</div>
              <div>
                <h2>Desktop access approved</h2>
                <p>
                  Approval was successful. Return to the PakPost Desktop app to finish
                  the connection and start using your remote workspace.
                </p>
              </div>
              <div className="pp-desktop-approval-actions">
                <button className="pp-desktop-button is-primary" type="button" onClick={closePage}>
                  Done — return to desktop
                </button>
                <a className="pp-desktop-button" href="/" target="_blank" rel="noopener noreferrer">
                  Open PakPost home
                </a>
              </div>
            </div>
          ) : session?.authenticated ? (
            <>
              <div className="pp-desktop-approval-account">
                <div className="pp-desktop-approval-avatar" aria-hidden="true">
                  {initials}
                </div>
                <div className="pp-desktop-approval-account-text">
                  <strong>{displayName}</strong>
                  <span>
                    Signed in and ready to approve this desktop connection.
                  </span>
                </div>
              </div>

              <div className="pp-desktop-approval-checklist">
                <div>
                  <strong>Before you approve</strong>
                  <ul>
                    <li>Make sure you started this request yourself from PakPost Desktop.</li>
                    <li>Only continue if you trust the computer running the desktop app.</li>
                    <li>This page never receives the desktop secret directly.</li>
                  </ul>
                </div>
              </div>

              <div className="pp-desktop-approval-actions">
                <button
                  className="pp-desktop-button is-primary"
                  type="button"
                  disabled={busy}
                  onClick={approve}
                >
                  {busy ? 'Approving...' : 'Approve desktop access'}
                </button>
                <button className="pp-desktop-button" type="button" disabled={checking} onClick={check}>
                  {checking ? 'Refreshing...' : 'Refresh session'}
                </button>
                <a className="pp-desktop-button" href="/" target="_blank" rel="noopener noreferrer">
                  Open PakPost
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="pp-desktop-approval-state">
                <div className="pp-desktop-approval-icon">1</div>
                <div>
                  <h2>Sign in with your browser first</h2>
                  <p>
                    To approve this desktop request, sign in to this PakPost instance in
                    your browser, then come back here and continue.
                  </p>
                </div>
              </div>

              <div className="pp-desktop-approval-checklist is-steps">
                <ol>
                  <li>Open PakPost in a new tab.</li>
                  <li>Sign in with your Google account.</li>
                  <li>Return here and press <strong>Check sign-in</strong>.</li>
                  <li>Approve the desktop request.</li>
                </ol>
              </div>

              <div className="pp-desktop-approval-actions">
                <a className="pp-desktop-button is-primary" href="/" target="_blank" rel="noopener noreferrer">
                  Open PakPost login
                </a>
                <button className="pp-desktop-button" type="button" disabled={checking} onClick={check}>
                  {checking ? 'Checking...' : 'Check sign-in'}
                </button>
              </div>
            </>
          )}

          {error ? (
            <div className="pp-desktop-approval-error" role="alert">
              {error}
            </div>
          ) : null}

          <footer className="pp-desktop-approval-footer">
            <span>
              Tip: after approval, you can close this tab and continue in PakPost Desktop.
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}
