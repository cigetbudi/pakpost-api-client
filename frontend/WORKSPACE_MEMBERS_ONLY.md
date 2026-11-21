# PakPost — Members & Roles Only Workspace UI

This UI simplification uses `pakpost-api-client-source-clean(4).zip` as its baseline. It can be applied with or without the separate Snappy Motion System patch.

## What changes

- Workspace Management has **Collections** and **Members & Roles** tabs; the Team editor and Team context-rail icon are removed.
- Sign-in, membership and role descriptions refer to Members/Workspaces instead of Teams.
- No automatic `GET /api/workspaces/{id}/teams` or team-member request on workspace selection. Team-only React state is removed.
- Saved sessions with a legacy `teams` explorer tab recover to **Collections**.
- The legacy `team.manage` permission is omitted from the member permission display, without changing actual backend authorization.

## What remains unchanged

- All backend APIs, permission checks, schema, migrations and existing Team records. **No data is deleted** and **no migration is required**.
- Membership invitations and multi-role Workspace RBAC. The `TeamLead` identifier and the display label **Team Lead** are kept; changing them is a separate, backward-compatibility-sensitive project.
- Workspace deletion still deletes its related legacy Team records, as the confirmation text warns.

**Security note:** This is a UI simplification, not an API access-control change. Authorized API clients can still use the legacy Teams endpoints. If Teams must be fully discontinued at the API level, plan a separate API deprecation with data migration and compatibility review.

## Verify

```bash
cd frontend
bun run test
bun run build
bun run test:e2e
```

Check visually: there is no Teams icon in the context rail, Workspace Management has exactly two tabs, invitations and role editing work, and switching Workspaces no longer makes Teams API requests in Network. No backend build or Neon migration is necessary for this patch.
