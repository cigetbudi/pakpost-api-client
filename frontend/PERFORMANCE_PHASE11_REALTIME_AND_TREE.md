# PakPost Phase 11 — Realtime & Explorer Performance Hardening

This patch builds on the **Phase 11 Explorer Progressive Rendering** patch. Apply it only once, **after** the Cloud Lazy Index and Progressive Explorer patches.

## Changes

- **Realtime queue reliability:** Drain all queued SignalR events in serial batches of 100. One in-flight reconciliation at a time; a workspace logout/reset invalidates the old timer. Previously a burst greater than 100 could leave events stranded until a further notification arrived.
- **Targeted detail hydration:** The Cloud index response intentionally excludes body, form-data and scripts. For each clean, open tab whose revision advances, request only that tab's complete record. Never replace editor data from an index-only DTO, never hydrate an unsaved dirty tab, and guard stale session/workspace responses. At most four detail reads in flight per affected Collection.
- **Realtime fan-out limits:** Merge repeated notifications by Collection before fetching; refresh at most three Collections simultaneously and avoid stale selected-Collection writes. Folder refresh dispatch is deduplicated.
- **Folder graph construction:** Memoize parent-chain validation and sort iteratively. Thousands of folders no longer trigger repeated ancestor scans, and cycles/missing parents stay visible at the root instead of hiding requests.
- **React tree cost:** Use a Set for selection membership instead of linear array lookups per row; stop cloning ancestor Sets while traversing already-validated Cloud nodes. Closed Local Collections continue to skip tree construction; open Local tree data is memoized by immutable requests-array identity.
- **Metadata rendering:** Cache parsed saved-request metadata only in a component-scoped WeakMap keyed by immutable index records; the cache is memory-only and does not write decrypted content to browser storage.
- **Vite import warning:** Remove redundant dynamic imports of `cloudFolderTree.js` in code paths where the tree module was already statically imported by Explorer. No additional library is introduced.

## Compatibility and security

- No API contract, EF Core migration, database schema, connection pool, workspace-encryption key, or browser-persisted cache changes.
- Requests and revision details remain loaded on demand. Data is not replicated into localStorage/sessionStorage, a global cache, or Redis.
- Realtime correctness continues to rely on the backend's revision checks; dirty tabs remain protected by conflict detection.
- Folder rendering stays progressive, not full virtualization. Large request bodies and editor code chunks are still loaded on demand.

## Verification

```bash
cd ~/riset/pakpost-api-client
./backend/scripts/verify-refactor.sh
cd frontend
bun run quality:check
```

Smoke-test a clean Cloud request updated by a second browser tab, then a dirty Cloud tab edited simultaneously. Clean tabs should refresh after the latest full payload is fetched; dirty tabs should not be overwritten. Try renaming/moving items, multiselect and delete, folder drag-and-drop, and large Local/Cloud Collections.

Development validation of this patch included Node-based regression tests (422 passed), import-graph check, JS/JSX parsing, and git apply/reverse-check. It did **not** include a Vite build, interactive browser test, or .NET build in the patch creation environment. No measured latency or FPS improvement is claimed.
