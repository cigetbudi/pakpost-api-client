# Signed desktop updates and release drafts

PakPost checks for updates only through Settings → About → Check for updates.
The native updater uses GitHub's public stable release endpoint; no PakPost
account, API request or workspace data is supplied. GitHub sees ordinary
network metadata such as IP address and request headers. Updates require a
separate install action and a valid artifact signature bound to its version.
The app identifier and SQLite path remain unchanged. Save work and back up
important local data first. Windows can close the application during install;
Linux/macOS may require a manual restart. Installer elevation may be required.

The first updater-enabled release must be installed manually. Check against a
published newer release only after testing installers on disposable systems.
No generic Linux manifest entry is emitted: DEB and RPM have separate keys.
Unbundled binaries are not supported as installer update targets.

Run the signed distribution workflow manually on main after merging reviewed
changes and syncing version fields and lockfiles. Set the Tauri private key and
password in repository Actions secrets. Restrict who can modify main/workflows
and access signing secrets; a separate protected release environment is
recommended. Never commit the key. A key signature is not OS code signing or
Apple notarization. The workflow builds signed update assets and a draft only.
Before publishing, verify all target installers, update from a previous
version, signature rejection, legal notices and corresponding dependency
source. Upload required matching dependency source archives and regenerate
SHA256SUMS if adding assets. New dependency licenses must be reviewed, including
Tauri updater transitives. Do not publish solely because CI is green.

The extension retains its independent v0.3.0 version in this change.
