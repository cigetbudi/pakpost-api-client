# Workbench Composition

- `App.jsx`: thin React entry; no business rules or data fetching.
- `app/hooks/useWorkbenchController.jsx`: orchestrates per-Workbench Zustand stores, feature controllers, local drafts, Cloud API and realtime lifecycles.
- `app/components/WorkbenchView.jsx`: React workbench layout and overlays only; receives a deliberately explicit view-model contract.
- Feature controllers remain in `features/*/controllers`; they own domain actions.
- Components keep their existing lazy-loaded boundaries.

The view model exposes **427** UI bindings. No session-only environment variable maps or Cloud token refs are exported unless actually used by the view. A follow-up should further group UI bindings by domain.
