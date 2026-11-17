# PakPost frontend architecture

The application remains a single React/Vite codebase that can be reused in Web
and later Tauri. Bun is the development tooling. No new runtime dependency was
introduced by the source reorganization.

## Entry and composition

- **`src/App.jsx`** — thin entry; invokes `useWorkbenchController()` and renders
  `<WorkbenchView />`. It does not manage network data or feature state.
- **`src/app/hooks/useWorkbenchController.jsx`** — per-mounted-Workbench
  composition root. Connects existing feature controllers, stores, and hooks.
  It is still the highest-coupling module; do not add new domain business rules
  here. Put those in their feature controllers/services instead.
- **`src/app/components/WorkbenchView.jsx`** — main workbench layout.
- **`src/app/components/WorkbenchOverlays.jsx`** — dialogs, context menus, Console,
  Runner, transient notifications. It uses a fragment, not extra DOM wrappers.
- **`src/app/components/DeferredFeatures.jsx`** — lazy imports for CodeMirror,
  Console, Runner, Settings, revision panels, and other optional views.

## Feature ownership

Every feature uses the same vocabulary:

```
src/
├── App.jsx
├── main.jsx
├── app/
│   ├── components/
│   └── hooks/
├── components/           # shared UI, layout primitives
├── features/
│   ├── auth/
│   ├── collections/
│   ├── console/
│   ├── environments/
│   ├── import-export/
│   ├── realtime/
│   ├── requests/
│   ├── settings/
│   └── workspace/
├── services/             # cross-feature HTTP client
├── styles/               # global + semantic CSS layers
└── utils/                # general-purpose helpers
```

`features/*/components` owns UI, `controllers` owns interactions,
`services` owns API calls and domain operations, `hooks` owns React lifecycle,
and `store` owns **per-Workbench** shared Zustand state. No feature files remain
loose in `src/features/`. See `REFACTOR_RELOCATION_MAP.md` for old → new paths.

## Invariants

1. **No global persisted Zustand store** for tokens, Cloud secrets, QA variables,
   or workspace-private data.
2. **Server-side RBAC and revision checks remain authoritative**. UI disable
   states are not access control.
3. SignalR sends invalidation metadata, never a full request body or token.
4. Do not remove lazy-loading when reusing editor or Runner components.
5. Keep the **CSS import order in `src/main.jsx`** when renaming selectors/files.
6. Do not delete historical behavioral regression tests without replacement
   coverage, especially auth, QA Sandbox, logout, variables and conflicts.

## Verification

```bash
node scripts/check-source-imports.mjs
node --test tests/*/*.test.js
bun run build
bun run perf:audit
bun run dev
```

A successful Node test run is not a browser integration test. Verify cold
startup, all themes, login/logout, Cloud and Local, two-account SignalR,
Ctrl+S conflicts, Collection Variables, Runner, and Script Diagnostics.
