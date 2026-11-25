# Troubleshooting

| Symptom | Check / action |
| --- | --- |
| Google sign-in fails | Match the frontend build client ID and backend client ID; authorize exact browser origin (scheme, host, port). Rebuild frontend after ID change. |
| Cannot create workspace | SelfHosted requires creator permission or instance admin; Public requires a verified Google identity. |
| HTTP 502 during deploy | Check `docker compose ps`, recent backend/Caddy logs, and both health endpoints. Wait for readiness; inspect persistent errors before rollback. |
| Database connection error | Check connection string, TLS, database target, network and migration status. Never reset the database to fix connectivity. |
| `libgssapi_krb5.so.2` warning | With production overlay, set `DB_DISABLE_GSS_ENCRYPTION=true` for a provider that uses TLS instead of GSS; preserve SSL settings. |
| Ephemeral Data Protection warning | Apply the production overlay after provisioning host key/certificate paths with the correct runtime UID. Do not regenerate existing keys. |
| Browser CORS error | Use a supported interceptor or Secure Proxy within its policy, or native desktop HTTP. Do not disable browser or server security globally. |
| Desktop login not available | Verify `DESKTOP_AUTH_ENABLED=true`, compatible server, HTTPS, health and system browser approval. |
| Keep me signed in fails | Check OS vault availability/unlock state and session revocation; memory-only login remains available. |
| Realtime status is Live but transport unclear | Check WebSocket upgrade (HTTP 101, often logged at disconnect); Long Polling can also show Live. Test updates across two clients. |
| Tauri dev port in use | Stop other Vite instances on 5173. Tauri starts its own dev server. |
| Linux AppImage build stalls | Build `bun run build --bundles deb` instead. Check network and CA permissions; never disable TLS validation. |
| Vite chunk warning | Run `bun run perf:audit` and `bun run perf:check` after a build. Warning threshold and transfer budget measure different things. |
| Stale mobile UI after deploy | Refresh the browser and verify current frontend assets. Test real Safari, not only Chromium responsive mode. |
| `cargo check --locked` fails | Check Rust version and lockfile changes. Resolve dependencies deliberately, review diff, then commit Cargo.lock. |

Collect minimal sanitized logs and reproduction steps. Do not include cookies, CSRF tokens, database URLs, private keys, real request payloads or workspace secret values in issues.
