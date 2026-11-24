PakPost Desktop approval page polish

What this patch changes
- Reworks /desktop-connect into a proper card-based approval page.
- Adds clear primary/secondary buttons for login, refresh, approve, and done states.
- Shows a success state with a prominent button after approval.
- Reuses existing theme variables so it matches PakPost light/dark themes better.

Files changed
- frontend/src/features/desktop/components/DesktopApproval.jsx
- frontend/src/styles/desktop-connections.css

How to apply
1. From repo root, unzip this patch into the project:
   unzip -o ~/Downloads/pakpost-desktop-approval-polish.zip -d .
2. Restart frontend / desktop dev server.
3. Open a desktop approval link again and test the signed-out, signed-in, and approved states.
