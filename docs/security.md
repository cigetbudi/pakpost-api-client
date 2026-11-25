# Security model and limitations

- Google Identity Services verifies an ID token on the server. Browser sessions use server-side session records, cookies and CSRF; desktop uses system-browser pairing and native session handling. Keep HTTPS and certificate verification enabled.
- Multi-role workspace authorization is enforced server-side, independently of instance administration. Member removal blocks subsequent authorized requests. Session expiry and revocation are checked; already downloaded data is not remotely erased.
- Workspace envelope encryption wraps per-workspace DEKs with the configured master key. Keep all keys and key IDs needed for existing data; Data Protection certificates are separate. This is not end-to-end encryption against the server operator.
- Secure Proxy validates destinations and restricts private networks and ports in the default deployment. Never enable private network access on a public service merely to fix CORS. Desktop native HTTP intentionally accesses the user's chosen destinations, including local networks.
- QuickJS has worker, memory, deadline and serialized data limits, with a restricted `pm.*` facade. CSP and native capabilities constrain desktop behavior. These controls are not a formal sandbox escape proof; inspect third-party scripts before running them.
- OS credential vault persistence is optional and stores the desktop session, not every local request/response. Browser local data, desktop SQLite, exports, logs and runner artifacts must be treated as sensitive. Export secrets only intentionally.
- Production logs reduce framework noise and redact structured Caddy headers/URI. Do not enable sensitive EF logging; do not publish raw logs or proxy payloads.

## Repository hygiene

If any credential was committed or shared, revoke it at every service that trusts it, rotate it, and coordinate removal from Git history before publishing. Preserve recovery access during SSH key rotation. Merely adding an ignore pattern or deleting the current file does not revoke an exposed credential. Avoid copying keys into patch artifacts or Docker contexts.

Keep `.env`, private certificates, database dumps, SQLite files and runtime backups outside Git and the Docker build context. Use [backup and recovery](backup-and-recovery.md) for key retention and [testing](testing.md) for security checks. No independent security audit or compliance certification is claimed.
