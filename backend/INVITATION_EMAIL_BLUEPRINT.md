# PakPost invitation email — Blueprint Courier

The `IWorkspaceInvitationEmailSender` interface and invitation flow remain unchanged. Both **Invite via email** and **Resend** use `SmtpWorkspaceInvitationEmailSender`, which now sends the selected Blueprint Courier email.

- HTML is stored in `Pakpost.Infrastructure/Services/EmailTemplates/WorkspaceInvitation.html` and embedded as an assembly resource.
- The PakPost logo is rendered from the repository branding SVG as a PNG, embedded using `cid:pakpost-logo`. No externally hosted image URL or inline base64 data URI is needed.
- The mail contains a `text/plain` body for mail clients without HTML. The HTML body has an `Accept invitation` button and the one-time fallback link.
- Workspace name, recipient email and invitation URL are HTML-encoded **in a single template substitution pass** to prevent markup or placeholder injection.
- Invite/resend URLs and expiry logic are unchanged. Invites remain single-use and expire in 7 days. No database migration or new environment variables.
- The email design is fixed to light mode, Courier typography and inline styles to maximize email-client compatibility.

## Test

```bash
cd backend
dotnet build Pakpost.slnx
dotnet test Pakpost.slnx --filter FullyQualifiedName~WorkspaceInvitationEmailMessageTests
dotnet test Pakpost.slnx
```

Send an invitation to a **test mailbox** after confirming the SMTP configuration. Inspect the MIME message in Gmail/Outlook and verify the CID logo, acceptance button, and fallback link. Do not share a real invitation token publicly.

Because the invitation is single-use and sent by email, do not fetch links or images from unexpected origins or log URLs containing `?invite=`. If SMTP fails, the existing error handling remains in effect.
