# Frontend regression tests

Tests are grouped by **feature domain**, not the release that introduced them:

| Folder | Coverage |
| --- | --- |
| `architecture/` | Module boundaries, CSS cascade, per-Workbench Zustand isolation, source composition |
| `auth/` | SSO, RBAC, invitations, QA sandbox, credential handling |
| `requests/` | Request editing, scripts, responses, drafts, diagnostics |
| `collections/` | Variables, import/export, Runner, Collection workflows |
| `environments/` | Workspace isolation, imports, comparison |
| `realtime/` | SignalR invalidation, stale revision protection, history |
| `console/` | Log redaction, lazy load, performance budget |
| `network/` | Local/Cloud scope, extension permissions, transport |

Historical regression filenames are retained so test history is easy to trace.
**Do not delete tests just because their names contain a version**: several guard
previous incidents, including blank-screen initialization, session leak, and
revision conflict. Once browser/component tests cover an equivalent behavior,
obsolete source-string assertions can be consolidated or retired deliberately.

```bash
node scripts/check-source-imports.mjs
node --test tests/*/*.test.js
bun test
bun run build
```

Node regression and source checks do **not** prove that React mounts in a real
browser. Use the smoke tests in the refactor guide after large source moves.
