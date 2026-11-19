# Pakpost Interceptor Extension (v0.3.0)

Native browser extension for Pakpost, using Manifest V3 and no external dependencies. Chrome/Edge and Firefox builds use the same core code with separate manifests.

## Build

```bash
bash extension/build.sh
```

The build outputs are `extension/dist/chrome/` and `extension/dist/firefox/`.

## Versioned release packages (v0.3.0)

Run this from the repository root to produce **reproducible, unsigned** artifacts
using only Bash and Python 3:

```bash
bash extension/release.sh
```

The output is:

- `extension/releases/pakpost-interceptor-chrome-v0.3.0.zip` — unpack for a
  developer install, or upload the archive to a Chrome Web Store publisher account.
- `extension/releases/pakpost-interceptor-firefox-v0.3.0.xpi` — **unsigned** AMO
  upload artifact, **not** a permanent-install XPI until Mozilla signs it.
- `extension/releases/SHA256SUMS` — verification for both archives.

The packager verifies that versions in both manifests match, the built manifests
match their source, and the bundle contains exactly the expected assets. CI
(`.github/workflows/interceptor-release.yml`) runs extension security tests,
packages on manual dispatch or an `interceptor-v*` tag, and uploads artifacts;
matching tags publish a GitHub Release. Example tag: `interceptor-v0.3.0`.

**Auto-update boundaries:** Chrome `Load unpacked` and Firefox temporary
add-ons are **development installs**; neither auto-updates from these archives.
For team-wide unattended updates, publish/sideload via an organization-approved
Chrome Web Store or enterprise-managed extension mechanism and publish a
**signed** Firefox extension to AMO or managed enterprise distribution. Do not
advertise GitHub ZIP/XPI downloads as browser-native automatic updates.
Never embed API secrets or signing credentials in the extension archive.


## Chrome / Edge (unpacked development install)

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode, then click **Load unpacked**.
3. Select the **extracted** `extension/dist/chrome` directory containing `manifest.json`.
4. Pin **Pakpost Interceptor** to the toolbar, open its popup.
5. Add your Pakpost web origin (example `http://localhost:5173`) to **Allowed Pakpost Origins**. Accept the browser permission prompt.
6. Choose **Allow All** to request broad HTTP/HTTPS permissions once, or choose **Specified Destinations** to scan and approve hosts in bulk. The browser owns the permission prompt. A denied permission keeps the previous mode.
7. For Specified, click **Scan this Pakpost tab**, review results, and **Grant selected destinations**. You can also paste multiple URLs. The previously approved list is retained when switching modes.
8. Reload the Pakpost web tab.
9. In Pakpost, go to **Settings → Interceptor → Browser Extension → Check connection**. It should show Connected.
10. In the workbench, Send as usual. QuickJS pre/post scripts and environment variables remain in Pakpost.

## Firefox (temporary development install)

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `extension/dist/firefox/manifest.json`.
4. Configure the popup the same way as Chrome (Allow All or Scan / Review / Grant).
5. Reload Pakpost and check connection in Settings.

Firefox temporary add-ons are removed when Firefox is restarted. For permanent installation, sign/distribute an XPI through an appropriate Mozilla Add-ons / enterprise process.

## Config examples

Use exact **origins** in the popup, not endpoint paths:

- Pakpost web origin: `http://localhost:5173` or `https://pakpost.example.com`.
- API destination: `https://api.dev.example.com` or `http://10.0.1.5:8080`.

The extension discovers host origins, not individual endpoint paths. Several endpoints on one host only require one entry. You can also paste newline/comma separated URLs for bulk import. Each entry may be removed later. The browser may grant host permissions for all ports at a given host; Pakpost **still checks the full exact origin, including port**, for every request.

The browser must already have LAN/VPN/DNS/TLS access to the destination. Installing the extension does not establish a VPN or trust a self-signed certificate.

## Destination access modes (v0.2.0)

- **Allow All:** asks for optional HTTP/HTTPS host permissions when you click Allow All. New API destinations no longer need to be entered or scanned. It does not authorize any new *Pakpost website* to control the extension.
- **Specified Destinations:** default for a new installation; requires the API's exact origin to be approved. Previously approved hosts remain available if you switch away and back.
- Returning to Specified immediately enables the explicit allowlist even if the browser still holds broad permissions. If desired, click **Revoke broad browser permission** to remove the wildcard grant. The browser may also revoke narrower grants at the same time; re-approve the Pakpost origin or destination if it disconnects.
- Browser access may be controlled separately by Chrome/Firefox extension site-access settings, which take precedence. Switching the popup mode does not override browser-denied permissions.
- Every request still checks its calling tab, exact Pakpost origin and port, HTTP method, unsafe headers, maximum body size, and browser host permission. Cookies are omitted and redirects are blocked.
- Toolbar icons are rendered from `frontend/public/branding/pakpost-favicon.svg`, bundled as PNGs. Popup destination icons use Chrome's built-in favicon cache. Firefox uses `/favicon.ico` on an approved host without cookies/referrer. No third-party favicon lookup service is contacted. Hosts without favicons get a neutral icon.

## v27.1: one-click host discovery

- After authorizing the current Pakpost site and reloading it, open the extension popup while on Pakpost and click **Scan this Pakpost tab**.
- The webpage supplies only deduplicated `http(s)://host[:port]` origins from loaded requests and environment URL values (never secrets, request paths or response bodies). Only loaded Neon request lists are scanned.
- Review the list, deselect any unwanted destinations, and press **Grant selected destinations**. Permissions are requested together from the browser. Nothing is allowed automatically.
- Alternatively paste several full URLs with newline/comma separators into **Or paste multiple URLs** and review. Paths are stripped; only origins are stored.
- Chrome/Firefox may prompt differently; approval is always controlled by the browser and may require accepting a permission dialog.
- Limit is 32 approved destination origins.

## Safety model

- **No install-time wildcard host access:** `optional_host_permissions` are requested from explicit Add, Grant selected, or Allow All clicks.
- **Separate caller and destination policies:** approved Pakpost websites control the extension; destinations use the selected All or Specified policy.
- **Every request is checked in the background:** extension sender URL, top-level tab origin, browser permission, destination origin and HTTP method.
- **Privacy:** requests are sent from the browser extension, not forwarded to Pakpost's backend; `credentials: 'omit'` means cookies and ambient credentials are not attached automatically.
- **No auto-follow redirects**, no browser-proxy fallback, timeout 20 seconds, max four concurrent sends per Pakpost origin.
- Response preview is capped at 1 MiB. Raw request bodies are capped at 128 KiB; multipart and binary at 5 MiB.
- Blocked request headers include Host, Cookie, Origin, Referer and proxy hop-by-hop headers. Explicit Authorization is supported.
- Nothing is uploaded to a third-party service by the extension itself. Configuration stores only origin strings in extension-local storage.
- Do **not** authorize untrusted Pakpost website origins: an authorized website can make calls to every API destination you grant it.
- You may need an administrator's permission to use extensions or access internal APIs on corporate devices.

## Troubleshooting

- **Not connected:** approve the exact Pakpost website origin, grant permission and **reload the tab**. Then Check connection.
- **Destination not allowed:** in Specified mode, approve the API's scheme+host+port origin. In Allow All mode, check browser wildcard permissions.
- **No VPN/DNS/TLS:** extension cannot make unreachable internal endpoints reachable. Check browser address bar/certificate trust and corporate network policies.
- **Redirect blocked:** request the target URL directly and allow its origin first.
- **Extension updated/reloaded:** reload the Pakpost webpage to reattach the content script.

## Known limitations

- Not a Chrome Web Store / AMO published package. Use unpacked/temporary installs for development testing only.
- Browser extension cross-origin access still depends on browser/corporate security policies. It is not a general bypass for network access restrictions.
- Headers forbidden by the browser cannot be set, and redirects are intentionally blocked.
- Local Agent and arbitrary third-party proxy URLs are not implemented in v27.
