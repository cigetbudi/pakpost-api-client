# PakPost frontend architecture (V8.5.7)

PakPost is **one React/Vite frontend**. Bun is used to install, build and test;
Zustand stores are created **per mounted Workbench**, not as process-wide
singletons. The same UI can later be hosted in Tauri with platform-specific
HTTP/auth/storage adapters.

## Boundaries

| Location | Responsibility |
| --- | --- |
| `src/App.jsx` | Mount the feature composition, authorize actions, select active view, connect state/controllers to UI |
| `src/features/*/components/` | Presentational UI; no direct Cloud mutation unless wrapped by an authorized controller |
| `src/features/*/hooks/` | Feature-scoped React state and lifecycle, used unconditionally from the Workbench |
| `src/features/*/store/` | Per-Workbench Zustand state and selectors; no secret persistence middleware |
| `src/features/*/controllers/` | Event handling and orchestration with explicit current-render dependencies |
| `src/features/*/services/` | HTTP commands, Cloud repository operations, execution pipeline, realtime reconciliation |
| `src/components/ui/` | Shared UI primitives and last-resort rendering error boundary |
| `src/styles/` | Semantic CSS layers in a deliberate order set by `main.jsx` |

The V8.5.7 controller split leaves handlers in `App.jsx` as **hoisted
forwarders**. This intentionally preserves initialization order and callback
identity usage from the previous version. Each factory captures the current
Workbench render; do **not** move the factories to a global singleton or add
`persist` middleware. If a controller needs another controller's action, pass
the App forwarder rather than creating a second independent instance.

### Controller ownership

- `createRequestTabActions` — rename, snapshot/restore, tab opening/closing, QA reset
- `createRequestExecutionActions` — pre-script, HTTP transport, post-script, runtime variables
- `createRequestHistoryActions` — stale revision warnings, merge, restore and history
- `createCollectionActions` — local/cloud tree/menu, imports, examples and management
- `createCollectionRunnerActions` — loading and cancellation of a selected Collection
- `createRealtimeActions` — invalidation/refresh and tab reconciliation on SignalR events
- `createInvitationActions` — invitation mutation/acceptance with workspace authorization

The Console, Runner, script editor, Workspace Manager and Version History UI
remain lazily loaded. No new runtime dependency was introduced by V8.5.7.

## Security and concurrent updates

1. A script's `pm.collectionVariables.set()` and QA environment edits stay in
   RAM/session overlays. They do not mutate shared Cloud defaults automatically.
2. Never cache recovered secrets in a persisted Zustand store, log raw auth
   headers, or emit request bodies in SignalR events.
3. Client-side `canEditCloud` and QA controls are UX guards, **not** a substitute
   for backend RBAC checks.
4. Backend revision/ETag checks are authoritative for Cloud Save and Restore.
   A SignalR notification is only a cache invalidation hint.
5. On logout or a workspace switch, stale HTTP responses and Runner results
   must not publish back into the newly selected user/workspace.
6. The error boundary **does not reset storage**. It provides a reload action
   if an unexpected render error escapes normal error handling.

## Regression workflow

```bash
cd frontend
bun run build
bun test
bun run perf:audit
bun run dev
```

Node built-in tests can also be run with `node --test tests/*.test.js`.
Static source assertions and controller unit tests **cannot prove that the
browser mounts successfully**. Always perform the browser checks for Local/
Cloud, scripts, SSO/logout, workspace switching, two-account realtime conflict,
Runner, History and all three appearance themes before merging a large refactor.

## Remaining work

`App.jsx` is approximately 1,020 lines (down from 1,655 in V8.5.6). A follow-up
can reduce it further by moving workspace data-fetch lifecycle and layout
orchestration into focused hooks and introducing automated browser mounting
checks. Avoid a big-bang move of all state into one global store.
