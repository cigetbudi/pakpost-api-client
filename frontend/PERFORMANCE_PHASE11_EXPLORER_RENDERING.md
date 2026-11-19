# Phase 11 — Explorer progressive rendering and render-path optimization

This patch applies **after** `pakpost-phase11-extreme-lazy-cloud-index-and-history-after-phase11.patch`.
It does not alter API contracts, PostgreSQL schema, workspace encryption, master keys, or extension permissions.

## Changes

1. **Cloud Collection closed:** `CloudFolderTree` is still mounted to preserve folder expansion, edit and selection state, but it stops building the Cloud folder/request tree or its request DOM until opened. Folder fetches already required `open` and remain unchanged.
2. **Cloud Collection open:** Requests within a branch render in chunks of **120**, with automatic next-chunk mounting when the user scrolls near `Show more requests`. The button also works when `IntersectionObserver` is unavailable. Filtering and sorting are applied before chunking, so searching does not silently discard matches.
3. **Hidden response examples:** Cloud and Local response-example rows are created only when the request's examples are expanded. Expand/collapse controls and `statusTone` are preserved.
4. **Local Explorer closed:** Closed Local Collections and Local folders do not build their hidden Branch DOM. The `expanded` map remains owned by `LocalCollectionsTree`, so reopening preserves folder disclosure state.
5. **Workbench hot path:** Cloud/Local collection filtering and sorting use `useMemo` on relevant inputs. The Command Palette no longer walks every Local request for each unrelated editor state update while closed.

## Behavioral and security boundaries

- Progressive mounting **does not** paginate the PostgreSQL API and is **not** a true constant-memory virtual scroller. Scrolling to the end can eventually mount every row; this deliberately preserves browser focus, multi-select, drag/drop and DOM-based keyboard selection.
- Chunks are per folder branch; a Collection containing many folders may still initially mount several chunks. A future release could implement true windowing with a separate model of keyboard selection and variable row heights.
- The request order remains unchanged unless the existing sort setting says otherwise. Matching requests beyond the first chunk remain discoverable by scrolling or using `Show more requests`.
- Request data and Workspace DEKs are not cached by these changes. Collection index and request detail endpoints continue to apply backend access checks. No browser persistent storage is introduced.
- Response-example collapse animations may become simpler because closed example children no longer remain mounted.

## Verification

Automated checks used while creating this patch:

```bash
node frontend/scripts/check-source-imports.mjs
node --test frontend/tests/*/*.test.js
```

Both must pass. For the normal project workflow:

```bash
cd frontend
bun run quality:check
```

Browser smoke: open/close Cloud and Local Collections, expand nested folders, search/sort across more than 120 requests, scroll to reveal later requests, Ctrl/Shift selection and bulk delete **only in a disposable test Collection**, F2 rename, move request/folder via drag and drop, open/close response examples, new request drafts, and switch active Cloud tabs.

Rollback: reverse this patch. No database rollback is necessary.
